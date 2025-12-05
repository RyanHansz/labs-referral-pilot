import json
import logging
from pprint import pformat
from typing import Iterator

from hayhooks import BasePipelineWrapper
from haystack import Pipeline
from haystack.components.builders import ChatPromptBuilder
from openai import OpenAI
from openinference.instrumentation import _tracers, using_attributes, using_metadata
from opentelemetry.trace.status import Status, StatusCode
from pydantic import BaseModel

from src.common import haystack_utils, phoenix_utils
from src.common.components import OpenAIWebSearchGenerator, ReadableLogger
from src.pipelines.generate_referrals.pipeline_wrapper import Resource

logger = logging.getLogger(__name__)
tracer = phoenix_utils.tracer_provider.get_tracer(__name__)


class ActionPlan(BaseModel):
    title: str
    summary: str
    content: str


action_plan_as_json = """
{
    "title": string,
    "summary": string,
    "content": string
}
"""


def create_websearch() -> OpenAIWebSearchGenerator:
    return OpenAIWebSearchGenerator()


class PipelineWrapper(BasePipelineWrapper):
    name = "generate_action_plan"

    def setup(self) -> None:
        pipeline = Pipeline()
        pipeline.add_component("llm", create_websearch())

        prompt_template = haystack_utils.get_phoenix_prompt("generate_action_plan")
        pipeline.add_component(
            instance=ChatPromptBuilder(
                template=prompt_template,
                required_variables=["resources", "action_plan_json", "user_query"],
            ),
            name="prompt_builder",
        )
        pipeline.connect("prompt_builder", "llm.messages")

        pipeline.add_component("logger", ReadableLogger())
        pipeline.connect("llm", "logger")

        self.pipeline = pipeline

    # Called for the `generate-action-plan/run` endpoint
    def run_api(
        self, resources: list[Resource] | list[dict], user_email: str, user_query: str
    ) -> dict:
        resource_objects = get_resources(resources)

        with using_attributes(user_id=user_email), using_metadata({"user_id": user_email}):
            # Must set using_metadata context before calling tracer.start_as_current_span()
            assert isinstance(tracer, _tracers.OITracer), f"Got unexpected {type(tracer)}"
            with tracer.start_as_current_span(  # pylint: disable=not-context-manager,unexpected-keyword-arg
                self.name, openinference_span_kind="chain"
            ) as span:
                result = self._run(resource_objects, user_email, user_query)
                span.set_input([r.name for r in resource_objects])
                span.set_output(result["response"])
                span.set_status(Status(StatusCode.OK))
                return result

    def _run(self, resource_objects: list[Resource], user_email: str, user_query: str) -> dict:
        response = self.pipeline.run(
            {
                "logger": {
                    "messages_list": [
                        {"resource_count": len(resource_objects), "user_email": user_email}
                    ],
                },
                "prompt_builder": {
                    "resources": format_resources(resource_objects),
                    "action_plan_json": action_plan_as_json,
                    "user_query": user_query,
                },
                "llm": {"model": "gpt-5-mini", "reasoning_effort": "low"},
            },
            include_outputs_from={"llm"},
        )
        logger.debug("Results: %s", pformat(response, width=160))
        return {"response": response["llm"]["replies"][0]._content[0].text}

    # Called for the `{pipeline_name}/chat` or `/chat/completions` streaming endpoint using Server-Sent Events (SSE)
    def run_chat_completion(self, model: str, messages: list, body: dict) -> Iterator[str]:
        """
        Streaming endpoint that yields Server-Sent Events for action plan generation.

        Args:
            model: Model name (will use gpt-5.1 regardless)
            messages: Chat messages (not used, we use body params instead)
            body: Request body containing resources, user_email, and user_query

        Yields:
            SSE-formatted strings with streaming content
        """
        try:
            # Extract parameters from request body
            resources = body.get("resources", [])
            user_email = body.get("user_email", "")
            user_query = body.get("user_query", "")

            resource_objects = get_resources(resources)

            logger.info(
                "Starting streaming action plan generation for %d resources, user=%s",
                len(resource_objects),
                user_email,
            )
            if resource_objects:
                logger.debug(
                    "Resources: %s",
                    ", ".join([r.name for r in resource_objects])
                )

            # Get the prompt template as ChatMessages
            prompt_messages = haystack_utils.get_phoenix_prompt("generate_action_plan")

            # Extract and format the prompt text from ChatMessages
            # For streaming, we modify the prompt to return pure markdown instead of JSON
            # This provides better UX as the formatted content appears progressively
            formatted_resources = format_resources(resource_objects)

            # Build the prompt by combining all message texts and replacing variables
            prompt_parts = []
            for msg in prompt_messages:
                msg_text = msg.text or ""
                # Replace template variables (no spaces - matches Mustache format {{variable}})
                msg_text = msg_text.replace("{{resources}}", formatted_resources)
                msg_text = msg_text.replace("{{user_query}}", user_query)
                # Remove the JSON schema placeholder
                msg_text = msg_text.replace("{{action_plan_json}}", "")

                prompt_parts.append(msg_text)

            # Add streaming-specific override instructions at the end
            streaming_override = """

**STREAMING MODE OVERRIDE:**
For this streaming response, IGNORE the JSON format requirement above. Instead:
- Output pure markdown text directly (no JSON wrapper)
- Start with a # heading for the title
- Include a brief summary paragraph
- Then provide the full action plan with markdown formatting (headers, lists, links, bold text)
- Do NOT wrap your response in JSON structure
- Output the content as if you're writing a document, not JSON

**CRITICAL - ACCURACY REQUIREMENT:**
- ONLY include timeline, document, or process details that are EXPLICITLY stated in the resource information provided
- DO NOT make up realistic-sounding but generic timelines (like "a few days", "1-2 weeks", "usually takes X time")
- If timeline information is not provided in the resource details, DO NOT include a Timeline section
- If specific documents are not listed in the resource, DO NOT guess what documents might be needed
- When in doubt, leave out speculative details - only include facts from the resources
"""
            prompt_parts.append(streaming_override)

            prompt = "\n\n".join(prompt_parts)

            # Log prompt snippet to verify resources are included
            if "{{resources}}" in prompt:
                logger.warning("Resources template variable NOT replaced in prompt!")
            else:
                logger.debug("Resources successfully replaced in prompt (length: %d chars)", len(prompt))

            # Call OpenAI Responses API with streaming
            client = OpenAI()
            logger.info("Starting OpenAI Responses API stream with model gpt-5.1")

            stream = client.responses.create(
                model="gpt-5.1",
                input=prompt,
                reasoning={"effort": "none"},
                stream=True,
            )

            # Process streaming events and yield them
            event_count = 0
            for event in stream:
                event_count += 1
                logger.debug(f"Received event #{event_count}: type={event.type}")

                if event.type == "response.output_text.delta":
                    # Yield the text delta directly (hayhooks will wrap it in SSE format)
                    if hasattr(event, "delta") and event.delta:
                        logger.debug(f"Yielding delta: {event.delta[:50]}...")
                        yield event.delta

                elif event.type == "response.done":
                    logger.info(f"Streaming completed after {event_count} events")
                    break

        except Exception as e:
            logger.error("Streaming error: %s", e, exc_info=True)
            # Yield error as plain text (hayhooks will format as SSE)
            yield f"Error: {str(e)}"


def get_resources(resources: list[Resource] | list[dict]) -> list[Resource]:
    """Ensure we have a list of Resource objects."""
    if not resources:
        return []
    if isinstance(resources[0], Resource):
        return resources  # type: ignore[return-value]
    return [Resource(**res) for res in resources]  # type: ignore[arg-type]


def format_resources(resources: list[Resource]) -> str:
    """Format a list of Resource objects into a readable string."""
    formatted_resources = []
    for resource in resources:
        resource_str = f"Name: {resource.name}\n"
        if resource.description:
            resource_str += f"- Description: {resource.description}\n"
        if resource.justification:
            resource_str += f"- Justification: {resource.justification}\n"
        if resource.addresses:
            resource_str += f"- Addresses: {', '.join(resource.addresses)}\n"
        if resource.phones:
            resource_str += f"- Phones: {', '.join(resource.phones)}\n"
        if resource.emails:
            resource_str += f"- Emails: {', '.join(resource.emails)}\n"
        if resource.website:
            resource_str += f"- Website: {resource.website}\n"
        formatted_resources.append(resource_str)
    return "\n".join(formatted_resources)
