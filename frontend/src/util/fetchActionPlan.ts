import { Resource } from "@/types/resources";
import { getApiDomain } from "./apiDomain";

export interface ActionPlan {
  title: string;
  summary: string;
  content: string;
}

/**
 * Fixes unescaped control characters in JSON string values
 * This handles cases where the LLM returns JSON with literal newlines, tabs, etc.
 */
function fixJsonControlCharacters(jsonString: string): string {
  let inString = false;
  let result = "";
  let prevChar = "";

  for (let i = 0; i < jsonString.length; i++) {
    const currentChar = jsonString[i];

    // Toggle string state when we hit an unescaped quote
    if (currentChar === '"' && prevChar !== "\\") {
      inString = !inString;
      result += currentChar;
    } else if (inString) {
      // Inside a string value - escape control characters
      if (currentChar === "\n") {
        result += "\\n";
      } else if (currentChar === "\r") {
        result += "\\r";
      } else if (currentChar === "\t") {
        result += "\\t";
      } else if (currentChar === "\b") {
        result += "\\b";
      } else if (currentChar === "\f") {
        result += "\\f";
      } else {
        result += currentChar;
      }
    } else {
      // Outside string values - keep as is
      result += currentChar;
    }

    prevChar = currentChar;
  }

  return result;
}

export async function fetchActionPlan(
  resources: Resource[],
  userEmail: string,
  userQuery: string,
): Promise<{ actionPlan: ActionPlan | null; errorMessage?: string }> {
  const apiDomain = await getApiDomain();
  const url = apiDomain + "generate_action_plan/run";
  const headers = {
    "Content-Type": "application/json",
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 120_000);

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        resources: resources,
        user_email: userEmail,
        user_query: userQuery,
      }),
      cache: "no-store",
      signal: ac.signal,
    });

    clearTimeout(timer);

    if (!upstream.ok) {
      console.error("Failed to generate action plan:", upstream.statusText);
      return {
        actionPlan: null,
        errorMessage:
          "The server encountered an unexpected error. Please try again later.",
      };
    }

    /* eslint-disable */
    const responseData = await upstream.json();
    // Extract the action plan from the API response
    const actionPlanText = responseData.result.response;
    console.log("Raw action plan text:", actionPlanText);

    // The LLM likes to return a multi-line JSON string, so
    // escape these characters or JSON.parse will fail
    const fixedJson = fixJsonControlCharacters(actionPlanText);
    const actionPlan = JSON.parse(fixedJson);
    /* eslint-enable */

    return { actionPlan: actionPlan as ActionPlan };
  } catch (error) {
    clearTimeout(timer);
    // Check if the error is due to timeout
    if (error instanceof Error && error.name === "AbortError") {
      return {
        actionPlan: null,
        errorMessage: "Request timed out, please try again.",
      };
    }
  }
  // Generic error handling
  console.error("Error fetching action plan");
  clearTimeout(timer);
  return {
    actionPlan: null,
    errorMessage:
      "The server encountered an unexpected error. Please try again later.",
  };
}

/**
 * Fetches action plan with streaming support using Server-Sent Events (SSE).
 * Calls onChunk for each text chunk received, allowing progressive display.
 */
export async function fetchActionPlanStreaming(
  resources: Resource[],
  userEmail: string,
  userQuery: string,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const apiDomain = await getApiDomain();
  // Use the standard chat completions endpoint with pipeline name as model
  const url = `${apiDomain}chat/completions`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 600_000); // 10 minutes timeout

  const requestBody = {
    model: "generate_action_plan", // Pipeline name as model
    messages: [{ role: "user", content: userQuery }],
    stream: true,
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

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      clearTimeout(timer);
      onError("Response body is null");
      return;
    }

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        clearTimeout(timer);
        onComplete();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();

          if (data === "[DONE]" || !data) {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // Check for error in the response
            if (parsed.error) {
              clearTimeout(timer);
              onError(parsed.error);
              return;
            }

            // Handle hayhooks response format: choices[0].delta.content
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }

            // Check for finish_reason to detect completion
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
