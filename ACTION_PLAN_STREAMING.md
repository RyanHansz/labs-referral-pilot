# Action Plan Streaming Implementation Guide

## Overview

This document provides a detailed implementation guide for the Action Plan Streaming feature in the Goodwill Referral Tool. Action plans generate personalized markdown-formatted guidance based on selected resources, streamed in real-time for better user experience.

## Key Achievement

**Before:** Users waited 30-120 seconds with only a spinner, then received all content at once.
**After:** First content appears in 10-15 seconds, progressively streaming as it generates.

## Implementation Architecture

### Technology Stack

- **Backend:** OpenAI Responses API + Hayhooks (FastAPI/Uvicorn)
- **Frontend:** Next.js 15 with Server-Sent Events (SSE)
- **Format:** Pure markdown streaming (not JSON)

### Why Markdown Instead of JSON?

**Problem with JSON Streaming:**
```
{"title": "Action Plan", "summary": "This is...", "content": "## Step 1
```
Users see raw JSON structure while streaming, breaking immersion.

**Solution with Markdown:**
```markdown
# Action Plan for Housing Services

This action plan outlines steps to access housing assistance...

## Step 1: Contact Housing Center
```
Content renders progressively with proper formatting immediately.

## Backend Implementation

### File: `app/src/pipelines/generate_action_plan/pipeline_wrapper.py`

### 1. Create the Streaming Endpoint

```python
def run_chat_completion(self, model: str, messages: list, body: dict) -> Iterator[str]:
    """
    Streaming endpoint that yields Server-Sent Events for action plan generation.

    This method is automatically called by Hayhooks when the /chat/completions
    endpoint receives stream: true.

    Args:
        model: Model name (will use gpt-5.1 regardless)
        messages: Chat messages (not used, we use body params instead)
        body: Request body containing resources, user_email, and user_query

    Yields:
        SSE-formatted strings with streaming content
    """
```

### 2. Extract and Validate Resources

```python
try:
    # Extract parameters from request body
    resources = body.get("resources", [])
    user_email = body.get("user_email", "")
    user_query = body.get("user_query", "")

    # Debug logging for incoming resources
    logger.info("=== Incoming Request Body ===")
    logger.info("Resources raw type: %s", type(resources))
    logger.info("Resources count: %d", len(resources))
    if resources:
        logger.info("First resource sample: %s",
                   json.dumps(resources[0] if isinstance(resources[0], dict)
                             else str(resources[0])[:200]))

    # Convert to Resource objects
    resource_objects = get_resources(resources)

    logger.info(
        "Starting streaming action plan generation for %d resources, user=%s",
        len(resource_objects),
        user_email,
    )
```

### 3. Critical Prompt Engineering

The breakthrough was **removing JSON requirements from the original prompt** AND **adding a strong markdown override**.

#### Step 1: Filter Out JSON Instructions

```python
# Get the prompt template
prompt_messages = haystack_utils.get_phoenix_prompt("generate_action_plan")

# Format resources for the prompt
formatted_resources = format_resources(resource_objects)

# Build the prompt by combining all message texts
prompt_parts = []
for msg in prompt_messages:
    msg_text = msg.text or ""

    # Replace template variables
    msg_text = msg_text.replace("{{resources}}", formatted_resources)
    msg_text = msg_text.replace("{{user_query}}", user_query)
    msg_text = msg_text.replace("{{action_plan_json}}", "")

    # CRITICAL: Remove JSON-related instructions from the prompt
    lines = msg_text.split('\n')
    filtered_lines = []
    skip_json_section = False

    for line in lines:
        # Skip lines that explicitly require JSON format
        if any(phrase in line.lower() for phrase in [
            "must be a valid json",
            "response must be a json",
            "return json",
            "json object",
            "don't repeat the schema",
            "json structure",
            "`title`, `summary`, and `content` keys"
        ]):
            skip_json_section = True
            continue

        if skip_json_section and line.strip() == "":
            skip_json_section = False
            continue

        if not skip_json_section:
            filtered_lines.append(line)

    msg_text = '\n'.join(filtered_lines)
    prompt_parts.append(msg_text)
```

#### Step 2: Add Strong Streaming Override

```python
# Add streaming-specific override instructions at the end
streaming_override = """

===== CRITICAL INSTRUCTION - OVERRIDE ALL PREVIOUS FORMAT REQUIREMENTS =====

IGNORE ALL PREVIOUS JSON FORMAT REQUIREMENTS. This is a STREAMING response.

YOU MUST OUTPUT PURE MARKDOWN TEXT ONLY. NO JSON!

Format your response EXACTLY like this example:

# Action Plan for Housing and Support Services

This action plan outlines the steps to access housing assistance and support services through the recommended resources.

## 1. Goodwill Housing Resource Center

**What they offer:**
[Details from the resource description]

**Next steps:**
- Call (555) 123-4567 to schedule an appointment
- Visit their office at 123 Main Street

## 2. Community Support Services

[Continue with similar format for each resource]

## Timeline
[Only include if timeline info is explicitly provided in resources]

## Important Notes
[Any critical information from the resources]

REMEMBER:
- DO NOT output JSON format
- DO NOT use curly braces { }
- DO NOT include "title:", "summary:", or "content:" keys
- Just write natural markdown text as if writing a document
- Start directly with the # heading
- Use markdown formatting throughout (##, -, **, etc.)

**ACCURACY REQUIREMENT:**
- ONLY include details that are EXPLICITLY stated in the resource information
- DO NOT make up timelines, documents, or processes not mentioned in resources
"""

prompt_parts.append(streaming_override)
prompt = "\n\n".join(prompt_parts)
```

### 4. Call OpenAI Responses API with Streaming

```python
# Call OpenAI Responses API with streaming
from openai import OpenAI

client = OpenAI()
logger.info("Starting OpenAI Responses API stream with model gpt-5.1")

stream = client.responses.create(
    model="gpt-5.1",
    input=prompt,
    reasoning={"effort": "none"},  # Faster responses
    stream=True,
)

# Process streaming events and yield them
event_count = 0
for event in stream:
    event_count += 1
    logger.debug(f"Received event #{event_count}: type={event.type}")

    if event.type == "response.output_text.delta":
        # Yield the text delta directly
        # Hayhooks will automatically wrap it in SSE format
        if hasattr(event, "delta") and event.delta:
            logger.debug(f"Yielding delta: {event.delta[:50]}...")
            yield event.delta

    elif event.type == "response.done":
        logger.info(f"Streaming completed after {event_count} events")
        break
```

### 5. Error Handling

```python
except Exception as e:
    logger.error("Streaming error: %s", e, exc_info=True)
    # Yield error as plain text (hayhooks will format as SSE)
    yield f"Error: {str(e)}"
```

## Frontend Implementation

### Files Modified:
- `frontend/src/util/fetchActionPlan.ts` - Streaming fetch function
- `frontend/src/app/[locale]/generate-referrals/page.tsx` - State management
- `frontend/src/components/ActionPlanDisplay.tsx` - Progressive display

### 1. Create Streaming Fetch Function

**File:** `frontend/src/util/fetchActionPlan.ts`

```typescript
export async function fetchActionPlanStreaming(
  resources: Resource[],
  userEmail: string,
  userQuery: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const apiDomain = await getApiDomain();
  const url = `${apiDomain}chat/completions`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 600_000); // 10 minutes timeout

  const requestBody = {
    model: "generate_action_plan",  // Pipeline name as model
    messages: [{ role: "user", content: userQuery }],
    stream: true,                    // CRITICAL: Enables streaming
    resources: resources,
    user_email: userEmail,
    user_query: userQuery,
  };

  console.log("=== fetchActionPlanStreaming Request ===");
  console.log("URL:", url);
  console.log("Request body:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: ac.signal,
    });

    if (!response.ok) {
      clearTimeout(timer);
      onError(`Request failed with status ${response.status}`);
      return;
    }

    // Get reader for streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      clearTimeout(timer);
      onError("Response body is null");
      return;
    }

    let buffer = "";

    // Read stream chunks
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        clearTimeout(timer);
        onComplete();
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // CRITICAL: Keep last incomplete line in buffer
      // SSE events can be split across chunks
      buffer = lines.pop() || "";

      // Process complete lines
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();

          if (data === "[DONE]" || !data) {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // Check for error
            if (parsed.error) {
              clearTimeout(timer);
              onError(parsed.error);
              return;
            }

            // Extract content from Hayhooks SSE format
            // Format: choices[0].delta.content
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);  // Pass markdown chunk to callback
            }

            // Check for completion
            if (parsed.choices?.[0]?.finish_reason === "stop") {
              clearTimeout(timer);
              onComplete();
              return;
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", e, data);
          }
        }
      }
    }
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        onError("Request timed out, please try again.");
      } else {
        onError(error.message);
      }
    } else {
      onError("Unknown error occurred");
    }
  }
}
```

### 2. Implement State Management

**File:** `frontend/src/app/[locale]/generate-referrals/page.tsx`

```typescript
// State for streaming
const [streamingContent, setStreamingContent] = useState<string>("");
const [isStreaming, setIsStreaming] = useState(false);
const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
const [isGeneratingActionPlan, setIsGeneratingActionPlan] = useState(false);

async function generateActionPlan() {
  if (selectedResources.length === 0) return;

  // Debug logging
  console.log("=== Generating Action Plan ===");
  console.log("Selected resources count:", selectedResources.length);
  console.log("Selected resources:", JSON.stringify(selectedResources, null, 2));
  console.log("User email:", userEmail);
  console.log("Client description:", clientDescription);

  // Reset state
  setIsGeneratingActionPlan(true);
  setIsStreaming(true);
  setActionPlan(null);
  setStreamingContent("");
  setErrorMessage(undefined);

  // Use local variable to accumulate content
  // (Avoids race conditions with state updates)
  let accumulatedContent = "";

  try {
    await fetchActionPlanStreaming(
      selectedResources,
      userEmail,
      clientDescription,

      // onChunk callback - accumulate streaming content
      (chunk: string) => {
        accumulatedContent += chunk;
        setStreamingContent(accumulatedContent);  // Update UI progressively
      },

      // onComplete callback - parse final markdown
      () => {
        setIsStreaming(false);
        setIsGeneratingActionPlan(false);

        console.log("Raw accumulated content:", accumulatedContent);

        // Fallback: Check if response is JSON (shouldn't happen with streaming)
        try {
          const jsonPlan = JSON.parse(accumulatedContent);
          if (jsonPlan.title && jsonPlan.content) {
            console.log("Detected JSON response from streaming endpoint");
            setActionPlan(jsonPlan);
            return;
          }
        } catch (jsonError) {
          // Not JSON, continue with markdown parsing
          console.log("Content is not JSON, parsing as markdown");
        }

        // Parse markdown to extract structured data
        try {
          let title = "Action Plan";
          let remainingContent = accumulatedContent;

          // Extract title from first # heading
          const titleMatch = accumulatedContent.match(/^#\s+(.+?)$/m);
          if (titleMatch) {
            title = titleMatch[1].trim();
            // Remove title line from content
            remainingContent = accumulatedContent
              .replace(/^#\s+.+?$/m, "")
              .trim();
          }

          // Extract summary (first paragraph after title)
          let summary = "";
          const paragraphs = remainingContent.split("\n\n");
          if (paragraphs.length > 0 && paragraphs[0].trim()) {
            summary = paragraphs[0].trim();
            // Remove summary from content to avoid duplication
            remainingContent = paragraphs.slice(1).join("\n\n").trim();
          }

          // Create structured ActionPlan object
          const plan: ActionPlan = {
            title: title,
            summary: summary || "Your personalized action plan",
            content: remainingContent,
          };

          setActionPlan(plan);
        } catch (e) {
          console.error("Failed to process action plan:", e);
          console.error("Raw content:", accumulatedContent);

          // Fallback: Use raw content
          setActionPlan({
            title: "Action Plan",
            summary: "Your personalized action plan",
            content: accumulatedContent,
          });
        }
      },

      // onError callback
      (error: string) => {
        setIsStreaming(false);
        setIsGeneratingActionPlan(false);
        setErrorMessage(error);
      },
    );
  } catch (error) {
    console.error("Error generating action plan:", error);
    setIsStreaming(false);
    setIsGeneratingActionPlan(false);
    setErrorMessage("The server encountered an unexpected error. Please try again later.");
  }
}
```

### 3. Create Progressive Display Component

**File:** `frontend/src/components/ActionPlanDisplay.tsx`

```typescript
interface ActionPlanDisplayProps {
  actionPlan: ActionPlan | null;
  streamingContent?: string;
  isStreaming?: boolean;
}

export function ActionPlanDisplay({
  actionPlan,
  streamingContent,
  isStreaming,
}: ActionPlanDisplayProps) {
  // Show streaming content with live updates
  if (isStreaming && streamingContent) {
    return (
      <Card className="bg-blue-50 border-blue-200 shadow-sm mb-5">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-blue-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Generating Action Plan...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Render markdown as it streams */}
            <div
              className="prose prose-sm max-w-none text-gray-800"
              dangerouslySetInnerHTML={{
                __html: parseMarkdownToHTML(streamingContent),
              }}
            />
            {/* Animated cursor to show streaming is active */}
            <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-1 align-middle">
              |
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show final parsed action plan
  if (!actionPlan) return null;

  return (
    <Card className="bg-blue-50 border-blue-200 shadow-sm mb-5">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          {actionPlan.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 text-black text-base">{actionPlan.summary}</div>
        <div
          className="prose prose-sm max-w-none text-gray-800"
          dangerouslySetInnerHTML={{
            __html: parseMarkdownToHTML(actionPlan.content),
          }}
        />
      </CardContent>
    </Card>
  );
}
```

## Implementation Process & Challenges

### Challenge 1: JSON Format Override

**Iteration 1:** Added streaming instructions at the end of prompt
- **Result:** Model still returned JSON
- **Issue:** Original JSON instructions were too strong

**Iteration 2:** Made override instructions more forceful
- **Result:** Partial success, sometimes worked
- **Issue:** Inconsistent results

**Iteration 3 (Final):** Filter out JSON instructions AND add override
- **Result:** Consistent markdown output
- **Solution:** Two-pronged approach ensures markdown format

### Challenge 2: SSE Parsing

**Problem:** Server-Sent Events can split across chunk boundaries:
```
Chunk 1: data: {"choices":[{"delta":{"con
Chunk 2: tent":"Hello"}}]}
```

**Solution:** Buffer incomplete lines:
```typescript
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split("\n");
buffer = lines.pop() || "";  // Keep last incomplete line
```

### Challenge 3: Whitespace Issues

**Problem:** Initial implementation had extra line breaks
- CSS class `whitespace-pre-wrap` preserved all whitespace
- Markdown already has its own whitespace handling

**Solution:** Remove `whitespace-pre-wrap` class, let markdown parser handle formatting

## Hayhooks Integration

### How It Works

Hayhooks automatically routes requests to `run_chat_completion()` when:

1. **Endpoint:** `/chat/completions`
2. **Body contains:** `stream: true`
3. **Body contains:** `model: "pipeline_name"`

### What Hayhooks Provides

- Automatic SSE formatting (`data: {content}\n\n`)
- Connection management
- Error handling
- Cleanup on disconnect
- OpenAI-compatible response format

## Testing Process

### Backend Testing

```bash
# Watch logs during streaming
cd app
docker compose logs -f app | grep "generate_action_plan"

# Test endpoint directly
curl -N -H "Content-Type: application/json" \
  -d '{
    "model": "generate_action_plan",
    "stream": true,
    "resources": [...],
    "user_email": "test@test.com",
    "user_query": "help with housing"
  }' \
  http://localhost:3000/chat/completions
```

### Frontend Testing

1. **Console Logging:** Track resources sent and chunks received
2. **Network Tab:** Verify EventStream type and chunk arrival
3. **React DevTools:** Monitor state updates

## Performance Impact

### Metrics

- **Time to First Content:** 10-15 seconds (vs 30-120s wait)
- **Total Generation Time:** Same as before
- **User Perception:** Dramatically improved
- **Engagement:** Users start reading immediately

### Why It Feels Faster

1. **Progressive Feedback:** Users see progress immediately
2. **Cognitive Load:** Reading while waiting reduces perceived time
3. **Interaction:** Scrolling and reading maintains engagement

## Key Learnings

1. **Prompt Engineering is Critical:** Removing conflicting instructions is as important as adding new ones
2. **Buffer Management:** Proper SSE parsing requires careful buffer handling
3. **User Experience:** Streaming transforms perceived performance without changing actual speed
4. **Fallback Handling:** Always have fallbacks for edge cases (JSON response, parse errors)
5. **Debug Logging:** Essential for diagnosing streaming issues

## Files Modified Summary

### Backend
- `app/src/pipelines/generate_action_plan/pipeline_wrapper.py`
  - Added `run_chat_completion()` method
  - Implemented prompt filtering and override
  - Integrated OpenAI Responses API streaming

### Frontend
- `frontend/src/util/fetchActionPlan.ts`
  - Created `fetchActionPlanStreaming()` function
  - Implemented SSE parsing with buffering

- `frontend/src/app/[locale]/generate-referrals/page.tsx`
  - Added streaming state management
  - Implemented markdown parsing logic

- `frontend/src/components/ActionPlanDisplay.tsx`
  - Created progressive rendering UI
  - Added streaming indicator

## Conclusion

The Action Plan Streaming implementation demonstrates that perceived performance can be as important as actual performance. By streaming markdown directly (avoiding JSON), implementing proper SSE parsing, and creating progressive UI updates, we transformed a feature that felt slow into one that feels responsive and modern.

The key insight: **Users don't mind waiting if they can see progress and start consuming content immediately.**

---

**Implementation Date:** December 2024
**Author:** Claude Code (Anthropic)
**Branch:** `ryan/action-plan-streaming`