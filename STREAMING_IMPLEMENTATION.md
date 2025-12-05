# Streaming Implementation Guide

## Overview

This document explains how streaming has been implemented for both **Resource Referrals** and **Action Plans** using OpenAI's Responses API and Server-Sent Events (SSE).

**Benefits of Streaming:**
- ⚡ **Faster perceived performance** - Users see results within 10-15 seconds instead of waiting 30-120 seconds
- 📊 **Progressive feedback** - Real-time updates as content generates
- ✨ **Better UX** - Users can start reading/reviewing while more content loads
- 🔄 **Consistent patterns** - Similar streaming UX for both features

---

## Architecture Overview

### Technology Stack

**Backend:**
- **OpenAI Responses API** - Streaming LLM responses
- **Hayhooks** - Pipeline framework with built-in SSE support
- **FastAPI/Uvicorn** - ASGI server for SSE streaming
- **PostgreSQL** - Database for saving results

**Frontend:**
- **Next.js 15** - React framework with streaming support
- **Server-Sent Events (SSE)** - Browser API for streaming
- **React State Management** - Progressive UI updates

### Flow Diagram

```
User Action → Frontend Request → Backend Pipeline → OpenAI API
     ↓              ↓                    ↓              ↓
  Click Button  Streaming Fetch    Process Chunks   Stream Tokens
     ↓              ↓                    ↓              ↓
  Show Loading  Parse SSE Events   Validate/Format  Generate Content
     ↓              ↓                    ↓              ↓
Update UI ← Update State ← Yield Chunks ← Stream Response
```

---

## Action Plan Streaming

### Overview

Action plans generate personalized markdown-formatted guidance based on selected resources. The streaming implementation outputs markdown directly (not JSON) for better progressive rendering.

### Backend Implementation

**File:** `app/src/pipelines/generate_action_plan/pipeline_wrapper.py`

#### Key Components

**1. Streaming Endpoint**

```python
def run_chat_completion(self, model: str, messages: list, body: dict) -> Iterator[str]:
    """
    Streaming endpoint that yields Server-Sent Events for action plan generation.
    """
```

This method is automatically called by Hayhooks when the `/chat/completions` endpoint is hit with `stream: true`.

**2. Prompt Engineering for Streaming**

```python
# Add streaming-specific override instructions
streaming_override = """

**STREAMING MODE OVERRIDE:**
For this streaming response, IGNORE the JSON format requirement above. Instead:
- Output pure markdown text directly (no JSON wrapper)
- Start with a # heading for the title
- Include a brief summary paragraph
- Then provide the full action plan with markdown formatting
- Do NOT wrap your response in JSON structure

**CRITICAL - ACCURACY REQUIREMENT:**
- ONLY include timeline, document, or process details that are EXPLICITLY stated in the resource information
- DO NOT make up realistic-sounding but generic timelines
- If timeline information is not provided, DO NOT include a Timeline section
"""
```

**Why Markdown Instead of JSON?**
- JSON structure shows raw formatting during streaming: `{"title": "Action Plan", "content": "Step 1...`
- Markdown renders progressively with proper formatting as it streams
- Better UX - users see formatted content immediately

**3. OpenAI Responses API Call**

```python
from openai import OpenAI

client = OpenAI()
stream = client.responses.create(
    model="gpt-5.1",
    input=prompt,
    reasoning={"effort": "none"},
    stream=True,
)

# Process streaming events
for event in stream:
    if event.type == "response.output_text.delta":
        if hasattr(event, "delta") and event.delta:
            yield event.delta  # Hayhooks wraps this in SSE format
    elif event.type == "response.done":
        break
```

**Key Points:**
- Uses `responses.create()` not `chat.completions.create()`
- `reasoning: {"effort": "none"}` for faster responses
- `stream=True` enables token-by-token streaming
- Each `yield` statement sends an SSE event to frontend

### Frontend Implementation

**Files:**
- `frontend/src/util/fetchActionPlan.ts`
- `frontend/src/app/[locale]/generate-referrals/page.tsx`
- `frontend/src/components/ActionPlanDisplay.tsx`

#### Key Components

**1. Streaming Fetch Function**

```typescript
export async function fetchActionPlanStreaming(
  resources: Resource[],
  userEmail: string,
  userQuery: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "generate_action_plan",
      messages: [{ role: "user", content: userQuery }],
      stream: true,
      resources: resources,
      user_email: userEmail,
      user_query: userQuery,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]" || !data) continue;

        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          onChunk(content);  // Accumulate markdown
        }
      }
    }
  }
}
```

**2. State Management**

```typescript
const [streamingContent, setStreamingContent] = useState<string>("");
const [isStreaming, setIsStreaming] = useState(false);

async function generateActionPlan() {
  setIsStreaming(true);
  let accumulatedContent = "";

  await fetchActionPlanStreaming(
    selectedResources,
    userEmail,
    clientDescription,
    // onChunk callback
    (chunk: string) => {
      accumulatedContent += chunk;
      setStreamingContent(accumulatedContent);
    },
    // onComplete callback
    () => {
      setIsStreaming(false);
      // Parse markdown to extract title/summary
      const plan = parseMarkdownContent(accumulatedContent);
      setActionPlan(plan);
    },
    // onError callback
    (error: string) => {
      setIsStreaming(false);
      setErrorMessage(error);
    },
  );
}
```

**3. Progressive Rendering**

```typescript
// ActionPlanDisplay.tsx
{isStreaming && streamingContent && (
  <div
    className="prose prose-sm max-w-none text-gray-800"
    dangerouslySetInnerHTML={{
      __html: parseMarkdownToHTML(streamingContent),
    }}
  />
)}
```

**Why Remove `whitespace-pre-wrap`?**
- Initially had extra line breaks during streaming
- `whitespace-pre-wrap` preserves all whitespace including single newlines
- Markdown parser handles whitespace correctly without this class

---

## Resource Referrals Streaming

### Overview

Resource referrals generate a list of community resources with contact information. The streaming implementation outputs resources one-by-one with special markers for parsing.

### Backend Implementation

**File:** `app/src/pipelines/generate_referrals/pipeline_wrapper.py`

#### Key Components

**1. Streaming Endpoint**

```python
def run_chat_completion(self, model: str, messages: list, body: dict) -> Iterator[str]:
    """
    Streaming endpoint that yields Server-Sent Events for resource generation.
    """
```

**2. Prompt Engineering with Markers**

```python
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
"""
```

**Why Use Markers?**
- JSON is streamed token-by-token: `{"name": "Fo` → `od Ba` → `nk"}`
- Can't parse incomplete JSON
- Markers indicate when a complete resource is available
- Enables validation before sending to frontend

**3. Incremental Parsing**

```python
buffer = ""
all_resources = []

for event in stream:
    if event.type == "response.output_text.delta":
        buffer += event.delta

        # Check if we have a complete resource
        while "---RESOURCE_END---" in buffer:
            start_idx = buffer.find("---RESOURCE_START---")
            end_idx = buffer.find("---RESOURCE_END---")

            if start_idx != -1 and end_idx != -1:
                json_start = start_idx + len("---RESOURCE_START---")
                resource_json = buffer[json_start:end_idx].strip()

                try:
                    resource_obj = json.loads(resource_json)
                    Resource(**resource_obj)  # Validate with Pydantic

                    all_resources.append(resource_obj)
                    yield json.dumps(resource_obj)  # Send to frontend

                except (json.JSONDecodeError, ValidationError) as e:
                    logger.warning(f"Invalid resource: {e}")

                # Remove processed resource from buffer
                buffer = buffer[end_idx + len("---RESOURCE_END---"):]
```

**4. Database Save After Completion**

```python
if resource_count > 0:
    try:
        result_json = json.dumps({"resources": all_resources})

        with config.db_session() as db_session, db_session.begin():
            llm_result = LlmResponse(raw_text=result_json)
            db_session.add(llm_result)
            db_session.flush()
            result_id = str(llm_result.id)

            # Yield result_id as special event
            yield json.dumps({"result_id": result_id})
    except Exception as e:
        logger.error("Failed to save streaming result: %s", e)
```

**Why Save After Streaming?**
- Email and Print features require a database record
- Saving during streaming would slow down display
- Save happens after all resources are sent to user
- `result_id` sent as final SSE event

### Frontend Implementation

**Files:**
- `frontend/src/util/fetchResources.ts`
- `frontend/src/app/[locale]/generate-referrals/page.tsx`

#### Key Components

**1. Streaming Fetch with result_id Capture**

```typescript
export async function fetchResourcesStreaming(
  clientDescription: string,
  userEmail: string,
  onResource: (resource: Resource) => void,
  onComplete: (resultId?: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  let capturedResultId: string | undefined = undefined;

  // ... SSE parsing ...

  const content = parsed.choices?.[0]?.delta?.content;
  if (content) {
    const contentObj = JSON.parse(content);

    // Check if this is a result_id response
    if (contentObj.result_id) {
      capturedResultId = contentObj.result_id;
    } else if (contentObj.name && contentObj.description) {
      // This is a resource
      onResource(contentObj as Resource);
    }
  }

  // When done, pass result_id to callback
  onComplete(capturedResultId);
}
```

**2. Progressive State Management**

```typescript
const [isStreamingResources, setIsStreamingResources] = useState(false);
const [retainedResources, setRetainedResources] = useState<Resource[]>([]);

async function handleClick() {
  setIsStreamingResources(true);
  setRetainedResources([]);  // Start with empty array
  setReadyToPrint(true);      // Show results area immediately

  const streamedResources: Resource[] = [];

  await fetchResourcesStreaming(
    request,
    userEmail,
    // onResource callback
    (resource: Resource) => {
      streamedResources.push(resource);
      setRetainedResources([...streamedResources]);  // Trigger re-render
    },
    // onComplete callback
    (resultId?: string) => {
      setIsStreamingResources(false);
      if (resultId) {
        setResultId(resultId);  // Enable email/print buttons
      }
    },
    // onError callback
    (error: string) => {
      setIsStreamingResources(false);
      setErrorMessage(error);
    },
  );
}
```

**3. Streaming UI Indicator**

```typescript
{isStreamingResources && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
    <div className="text-blue-900 font-medium">
      {retainedResources.length > 0
        ? `Searching for resources... Found ${retainedResources.length} so far`
        : "Searching for resources..."}
    </div>
  </div>
)}
```

---

## Hayhooks Integration

### How Hayhooks Enables Streaming

Hayhooks is a pipeline deployment framework that wraps Haystack pipelines as REST APIs. It has built-in support for SSE streaming via the `/chat/completions` endpoint.

**Endpoint Mapping:**

| Endpoint | Method | Streaming | Used For |
|----------|--------|-----------|----------|
| `/{pipeline_name}/run` | POST | No | Non-streaming (original) |
| `/{pipeline_name}/chat` | POST | Yes | Streaming via pipeline name |
| `/chat/completions` | POST | Yes | Streaming via `model` param |

**Implementation:**

```python
class PipelineWrapper(BasePipelineWrapper):
    name = "generate_action_plan"  # or "generate_referrals"

    # Non-streaming endpoint
    def run_api(self, resources: list[Resource], user_email: str, user_query: str) -> dict:
        # Returns complete result
        pass

    # Streaming endpoint (called by Hayhooks)
    def run_chat_completion(self, model: str, messages: list, body: dict) -> Iterator[str]:
        # Yields SSE chunks
        pass
```

**Frontend Request:**

```typescript
fetch(`${apiDomain}chat/completions`, {
  method: "POST",
  body: JSON.stringify({
    model: "generate_action_plan",  // Maps to pipeline.name
    stream: true,                   // Enables streaming
    // ... custom parameters in body ...
  }),
})
```

**Hayhooks automatically:**
1. Routes to `run_chat_completion()` when `stream: true`
2. Wraps yielded strings in SSE format: `data: <content>\n\n`
3. Handles OpenAI-compatible response format
4. Manages connection lifecycle and cleanup

---

## Server-Sent Events (SSE) Format

### Protocol Overview

SSE is a standard for server-to-client streaming over HTTP:

```
data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n
data: {"choices":[{"delta":{"content":" world"}}]}\n\n
data: [DONE]\n\n
```

**Key Points:**
- Each message starts with `data: `
- Messages end with two newlines (`\n\n`)
- Browser's `ReadableStream` API handles parsing
- Automatic reconnection on disconnect
- One-directional (server → client only)

### Hayhooks SSE Format

Hayhooks wraps yielded content in OpenAI-compatible format:

```json
{
  "choices": [
    {
      "delta": {
        "content": "actual content here"
      },
      "finish_reason": null
    }
  ]
}
```

**Final Event:**
```json
{
  "choices": [
    {
      "delta": {},
      "finish_reason": "stop"
    }
  ]
}
```

---

## Error Handling

### Backend Error Handling

**1. Validation Errors (Resources)**
```python
try:
    resource_obj = json.loads(resource_json)
    Resource(**resource_obj)  # Pydantic validation
    yield json.dumps(resource_obj)
except (json.JSONDecodeError, ValidationError) as e:
    logger.warning(f"Resource validation failed: {e}")
    # Continue streaming, skip invalid resource
```

**2. Streaming Errors**
```python
try:
    # ... streaming logic ...
except Exception as e:
    logger.error("Streaming error: %s", e, exc_info=True)
    yield json.dumps({"error": str(e)})
```

**3. Database Save Errors**
```python
try:
    # Save to database
    yield json.dumps({"result_id": result_id})
except Exception as e:
    logger.error("Failed to save streaming result: %s", e)
    # Don't fail entire stream, just log error
    yield json.dumps({"error": f"Failed to save result: {str(e)}"})
```

### Frontend Error Handling

**1. Parse Errors**
```typescript
try {
  const parsed = JSON.parse(data);
  if (parsed.error) {
    onError(parsed.error);
    return;
  }
} catch (e) {
  console.error("Failed to parse SSE data:", e, data);
}
```

**2. Network Errors**
```typescript
try {
  const response = await fetch(url, { ... });
  if (!response.ok) {
    onError(`Request failed with status ${response.status}`);
    return;
  }
} catch (error) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      onError("Request timed out, please try again.");
    } else {
      onError(error.message);
    }
  }
}
```

**3. UI Error Display**
```typescript
{errorMessage && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800">{errorMessage}</p>
  </div>
)}
```

---

## Performance Considerations

### Timing Comparison

**Before Streaming (Non-streaming endpoint):**
```
User clicks button → Wait 30-120s → All results appear at once
```

**With Streaming:**
```
User clicks button → 10-15s → First result → 5-10s → Next result → ...
Total time: Same, but feels much faster!
```

### Optimization Techniques

**1. Reasoning Effort**
```python
client.responses.create(
    model="gpt-5.1",
    reasoning={"effort": "low"},  # Faster responses
    stream=True,
)
```

**2. Progressive UI Updates**
```typescript
// Use functional updates to avoid race conditions
setRetainedResources(prev => [...prev, newResource]);
```

**3. Debouncing**
```typescript
// For very fast streams, consider debouncing UI updates
let updateTimer: NodeJS.Timeout;
const debouncedUpdate = (resource: Resource) => {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    setRetainedResources(prev => [...prev, resource]);
  }, 100);
};
```

**4. Timeout Management**
```typescript
const timer = setTimeout(() => ac.abort(), 600_000);  // 10 minutes
// Longer timeout for streaming vs non-streaming
```

---

## Testing & Debugging

### Backend Testing

**1. Check Pipeline Loading**
```bash
cd app
docker compose logs app | grep "generate_referrals\|generate_action_plan"
```

**2. Watch Streaming Logs**
```bash
docker compose logs -f app
```

Look for:
- `Starting streaming resource generation`
- `Extracted resource #1: ResourceName`
- `Streaming completed after X events, Y resources`
- `Saved streaming result with id=<UUID>`

**3. Test Endpoint Directly**
```bash
curl -N -H "Content-Type: application/json" \
  -d '{"model":"generate_referrals","stream":true,"query":"test","user_email":"test@test.com"}' \
  http://localhost:3000/chat/completions
```

The `-N` flag disables buffering so you see streaming output.

### Frontend Testing

**1. Browser Console Logging**
```typescript
console.log(`Received resource: ${resource.name}`);
console.log(`Captured result_id: ${resultId}`);
console.log(`Streaming complete. Total: ${streamedResources.length}`);
```

**2. Network Tab**
- Open DevTools → Network tab
- Look for `/chat/completions` request
- Type should be `EventStream`
- Should see chunks arriving in real-time

**3. React DevTools**
- Watch state changes: `isStreaming`, `streamingContent`, `retainedResources`
- Verify progressive updates

### Common Issues

**Issue: No streaming, waits for complete response**
- **Cause:** `stream: true` not in request body
- **Fix:** Verify fetch body includes `stream: true`

**Issue: Extra line breaks in action plan**
- **Cause:** `whitespace-pre-wrap` CSS class
- **Fix:** Remove from streaming view

**Issue: Resources not appearing**
- **Cause:** Markers not found in buffer
- **Fix:** Check prompt includes `---RESOURCE_START---` / `---RESOURCE_END---`

**Issue: Email button doesn't appear**
- **Cause:** `result_id` not captured
- **Fix:** Check backend yields `{"result_id": "..."}` after resources

**Issue: Frontend errors on parse**
- **Cause:** Incomplete JSON in buffer
- **Fix:** Verify `lines.pop()` keeps last incomplete line in buffer

---

## Future Enhancements

### Potential Improvements

**1. Skeleton Loaders**
```typescript
// Show placeholder cards while streaming
{isStreaming && <ResourceCardSkeleton count={5} />}
```

**2. Progressive Action Plan Sections**
```typescript
// Parse and display sections as they complete
if (accumulatedContent.includes("## Timeline")) {
  setTimelineSection(extractSection(accumulatedContent, "Timeline"));
}
```

**3. Retry Logic**
```typescript
const MAX_RETRIES = 3;
let retryCount = 0;

async function fetchWithRetry() {
  try {
    await fetchResourcesStreaming(...);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(fetchWithRetry, 2000 * retryCount);
    }
  }
}
```

**4. Streaming Analytics**
```typescript
// Track streaming performance
const startTime = Date.now();
let firstResourceTime = 0;

onResource: (resource) => {
  if (firstResourceTime === 0) {
    firstResourceTime = Date.now() - startTime;
    analytics.track("first_resource_time", firstResourceTime);
  }
}
```

**5. Cancellation Support**
```typescript
const abortController = new AbortController();

<Button onClick={() => abortController.abort()}>
  Cancel Generation
</Button>
```

---

## Summary

### Key Takeaways

1. **Streaming provides better UX** without changing total generation time
2. **OpenAI Responses API** is simpler than Chat Completions for streaming
3. **Hayhooks handles SSE** automatically via `run_chat_completion()`
4. **Incremental parsing** enables validation before sending to frontend
5. **Database save after streaming** enables email/print without slowing display
6. **Markdown streaming** provides better UX than JSON streaming
7. **Markers** (`---RESOURCE_START---`) enable parsing incomplete JSON

### Architecture Patterns

**Backend Pattern:**
```python
def run_chat_completion(...) -> Iterator[str]:
    # 1. Load data and build prompt
    # 2. Add streaming-specific instructions
    # 3. Call OpenAI with stream=True
    # 4. Process events incrementally
    # 5. Validate and yield chunks
    # 6. Save to database after completion
```

**Frontend Pattern:**
```typescript
async function streamingFetch(onChunk, onComplete, onError) {
  // 1. Fetch with stream: true
  // 2. Get reader from response.body
  // 3. Loop: read chunks, parse SSE
  // 4. Extract content from SSE format
  // 5. Call onChunk for each piece
  // 6. Call onComplete when done
}
```

### Files Modified

**Backend:**
- `app/src/pipelines/generate_action_plan/pipeline_wrapper.py`
- `app/src/pipelines/generate_referrals/pipeline_wrapper.py`

**Frontend:**
- `frontend/src/util/fetchActionPlan.ts`
- `frontend/src/util/fetchResources.ts`
- `frontend/src/app/[locale]/generate-referrals/page.tsx`
- `frontend/src/components/ActionPlanDisplay.tsx`

**Git Branches:**
- `ryan/action-plan-streaming` - Action plan streaming implementation
- `ryan/referral-streaming` - Resource referrals streaming implementation

---

## References

- [OpenAI Responses API Docs](https://platform.openai.com/docs/api-reference/responses)
- [Hayhooks Documentation](https://docs.haystack.deepset.ai/docs/hayhooks)
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [MDN: Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [React Streaming Patterns](https://react.dev/reference/react-dom/server/renderToReadableStream)

---

**Document Version:** 1.0
**Last Updated:** December 4, 2025
**Author:** Claude Code (Anthropic)
