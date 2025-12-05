import json
import logging
from enum import Enum
from pprint import pformat
from typing import Iterator, Optional

import httpx
from fastapi import HTTPException
from hayhooks import BasePipelineWrapper
from haystack import Pipeline
from haystack.components.builders import ChatPromptBuilder
from haystack.core.errors import PipelineRuntimeError
from openai import OpenAI
from openinference.instrumentation import _tracers, using_attributes, using_metadata
from opentelemetry.trace.status import Status, StatusCode
from pydantic import BaseModel

from src.common import components, haystack_utils, phoenix_utils

logger = logging.getLogger(__name__)
tracer = phoenix_utils.tracer_provider.get_tracer(__name__)


class ReferralType(str, Enum):
    EXTERNAL = "external"
    GOODWILL = "goodwill"
    GOVERNMENT = "government"


class Resource(BaseModel):
    name: str
    addresses: list[str]
    phones: list[str]
    emails: list[str]
    website: Optional[str] = None
    description: str
    justification: str
    referral_type: Optional[ReferralType] = None


class ResourceList(BaseModel):
    resources: list[Resource]


response_schema = """
{
    "resources": {
        "name": string;
        "addresses": string[];
        "phones": string[];
        "emails": string[];
        "website"?: string | null;
        "description": string;
        "justification": string;
        "referral_type"?: "external" | "goodwill" | "government" | null;
    }[];
}
"""


class PipelineWrapper(BasePipelineWrapper):
    name = "generate_referrals"

    def setup(self) -> None:
        # Do not rely on max_runs_per_component strictly, i.e., a component may run max_runs_per_component+1 times.
        # The component_visits counter for max_runs_per_component is reset with each call to pipeline.run()
        pipeline = Pipeline(max_runs_per_component=3)
        pipeline.add_component("load_supports", components.LoadSupports())
        pipeline.add_component(
            "prompt_builder",
            ChatPromptBuilder(
                # List all variables (required and optional) that could be used in the prompt template.
                # Don't include "template" as it is implicitly required by ChatPromptBuilder
                variables=[
                    "query",
                    "supports",
                    "response_json",
                    "error_message",
                    "invalid_replies",
                ],
            ),
        )
        pipeline.add_component("llm", components.OpenAIWebSearchGenerator())
        pipeline.add_component("output_validator", components.LlmOutputValidator(ResourceList))
        pipeline.add_component("save_result", components.SaveResult())

        pipeline.connect("load_supports.supports", "prompt_builder.supports")
        pipeline.connect("prompt_builder", "llm.messages")
        pipeline.connect("llm.replies", "output_validator")
        pipeline.connect("output_validator.valid_replies", "save_result.replies")

        # Re-trigger the prompt builder with error_message and invalid_replies
        pipeline.connect("output_validator.error_message", "prompt_builder.error_message")
        pipeline.connect("output_validator.invalid_replies", "prompt_builder.invalid_replies")

        pipeline.add_component("logger", components.ReadableLogger())
        pipeline.connect("output_validator.valid_replies", "logger")

        self.pipeline = pipeline

    # Called for the `generate-referrals/run` endpoint
    def run_api(self, query: str, user_email: str, prompt_version_id: str = "") -> dict:
        with using_attributes(user_id=user_email), using_metadata({"user_id": user_email}):
            # Must set using_metadata context before calling tracer.start_as_current_span()
            assert isinstance(tracer, _tracers.OITracer), f"Got unexpected {type(tracer)}"
            with tracer.start_as_current_span(  # pylint: disable=not-context-manager,unexpected-keyword-arg
                self.name, openinference_span_kind="chain"
            ) as span:
                result = self._run(query, user_email, prompt_version_id)
                span.set_input(query)
                try:
                    resp_obj = json.loads(result["llm"]["replies"][-1].text)
                    span.set_output([r["name"] for r in resp_obj["resources"]])
                except (KeyError, IndexError):
                    span.set_output(result["llm"]["replies"][-1].text)
                span.set_status(Status(StatusCode.OK))
                return result

    def _run(self, query: str, user_email: str, prompt_version_id: str = "") -> dict:
        # Retrieve the requested prompt_version_id and error if requested prompt version is not found
        try:
            prompt_template = haystack_utils.get_phoenix_prompt(
                "generate_referrals", prompt_version_id
            )
        except httpx.HTTPStatusError as he:
            raise HTTPException(
                status_code=422,
                detail=f"The requested prompt version '{prompt_version_id}' could not be retrieved due to HTTP status {he.response.status_code}",
            ) from he

        try:
            response = self.pipeline.run(
                {
                    "logger": {
                        "messages_list": [{"query": query, "user_email": user_email}],
                    },
                    "prompt_builder": {
                        "template": prompt_template,
                        "query": query,
                        "response_json": response_schema,
                    },
                    "llm": {"model": "gpt-5-mini", "reasoning_effort": "low"},
                },
                include_outputs_from={"llm", "save_result"},
            )
            logger.debug("Results: %s", pformat(response, width=160))
            return response
        except PipelineRuntimeError as re:
            logger.error("PipelineRuntimeError: %s", re, exc_info=True)
            raise HTTPException(status_code=500, detail=str(re)) from re
        except Exception as e:
            logger.error("Error %s: %s", type(e), e, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}") from e

    # Called for the `{pipeline_name}/chat` or `/chat/completions` streaming endpoint using Server-Sent Events (SSE)
    def run_chat_completion(self, model: str, messages: list, body: dict) -> Iterator[str]:
        """
        Streaming endpoint that yields Server-Sent Events for resource generation.

        Args:
            model: Model name (will use gpt-5.1 regardless)
            messages: Chat messages (not used, we use body params instead)
            body: Request body containing query and user_email

        Yields:
            SSE-formatted strings with streaming content (individual resources as JSON)
        """
        try:
            # Extract parameters from request body
            query = body.get("query", "")
            user_email = body.get("user_email", "")

            logger.info(
                "Starting streaming resource generation for query: %s, user=%s",
                query[:100],
                user_email,
            )

            # Get supports data
            load_supports = components.LoadSupports()
            supports_result = load_supports.run()
            supports = supports_result.get("supports", [])

            logger.info("Loaded %d support resources", len(supports))

            # Get the prompt template
            prompt_template = haystack_utils.get_phoenix_prompt("generate_referrals")

            # Build the prompt by combining all message texts and replacing variables
            prompt_parts = []
            for msg in prompt_template:
                msg_text = msg.text or ""
                # Replace template variables (Mustache format)
                msg_text = msg_text.replace("{{query}}", query)
                msg_text = msg_text.replace("{{supports}}", json.dumps(supports, indent=2))
                msg_text = msg_text.replace("{{response_json}}", response_schema)
                # Remove error-related placeholders for initial request
                msg_text = msg_text.replace("{{error_message}}", "")
                msg_text = msg_text.replace("{{invalid_replies}}", "")

                prompt_parts.append(msg_text)

            # Add streaming-specific override instructions
            streaming_override = """

**STREAMING MODE OVERRIDE:**
For this streaming response, output resources ONE AT A TIME as you generate them.

Output format:
- Start each resource with exactly: ---RESOURCE_START---
- Then output a single valid JSON object for that resource
- End each resource with exactly: ---RESOURCE_END---
- Do NOT wrap in a "resources" array
- Output resources progressively as you generate them

Example output:
---RESOURCE_START---
{
  "name": "Resource Name",
  "addresses": ["123 Main St"],
  "phones": ["555-1234"],
  "emails": ["contact@example.com"],
  "website": "https://example.com",
  "description": "Description here",
  "justification": "Why this helps",
  "referral_type": "external"
}
---RESOURCE_END---
---RESOURCE_START---
{
  "name": "Another Resource",
  ...
}
---RESOURCE_END---

Generate 5-10 resources total, outputting each one immediately as you complete it.
"""
            prompt_parts.append(streaming_override)

            prompt = "\n\n".join(prompt_parts)

            # Call OpenAI Responses API with streaming
            client = OpenAI()
            logger.info("Starting OpenAI Responses API stream with model gpt-5.1")

            stream = client.responses.create(
                model="gpt-5.1",
                input=prompt,
                reasoning={"effort": "low"},
                stream=True,
            )

            # Buffer for accumulating content
            buffer = ""
            resource_count = 0

            # Process streaming events
            event_count = 0
            for event in stream:
                event_count += 1

                if event.type == "response.output_text.delta":
                    if hasattr(event, "delta") and event.delta:
                        buffer += event.delta

                        # Check if we have a complete resource
                        while "---RESOURCE_END---" in buffer:
                            # Extract the resource
                            start_marker = "---RESOURCE_START---"
                            end_marker = "---RESOURCE_END---"

                            start_idx = buffer.find(start_marker)
                            end_idx = buffer.find(end_marker)

                            if start_idx != -1 and end_idx != -1:
                                # Extract JSON between markers
                                json_start = start_idx + len(start_marker)
                                resource_json = buffer[json_start:end_idx].strip()

                                try:
                                    # Validate it's proper JSON
                                    resource_obj = json.loads(resource_json)

                                    # Validate against Resource model
                                    Resource(**resource_obj)

                                    resource_count += 1
                                    logger.info(f"Extracted resource #{resource_count}: {resource_obj.get('name', 'Unknown')}")

                                    # Yield the resource as JSON
                                    yield json.dumps(resource_obj)

                                except json.JSONDecodeError as e:
                                    logger.warning(f"Failed to parse resource JSON: {e}")
                                    logger.debug(f"Invalid JSON: {resource_json[:200]}")
                                except Exception as e:
                                    logger.warning(f"Resource validation failed: {e}")

                                # Remove processed resource from buffer
                                buffer = buffer[end_idx + len(end_marker):]
                            else:
                                break

                elif event.type == "response.done":
                    logger.info(f"Streaming completed after {event_count} events, {resource_count} resources")

                    # Try to extract any remaining resource in buffer
                    if "---RESOURCE_START---" in buffer and "---RESOURCE_END---" not in buffer:
                        # Incomplete resource at end, try to parse what we have
                        logger.debug("Attempting to parse incomplete final resource")

                    break

            if resource_count == 0:
                logger.warning("No resources were generated")
                yield json.dumps({
                    "error": "No resources were generated. Please try a different query."
                })

        except Exception as e:
            logger.error("Streaming error: %s", e, exc_info=True)
            # Yield error as JSON
            yield json.dumps({"error": str(e)})
