import { Resource, ResourcesSchema } from "@/types/resources";
import { getApiDomain } from "./apiDomain";

/**
 * Fetches resources with streaming support using Server-Sent Events (SSE).
 * Calls onResource for each resource received, allowing progressive display.
 */
export async function fetchResourcesStreaming(
  clientDescription: string,
  userEmail: string,
  onResource: (resource: Resource) => void,
  onComplete: (resultId?: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  const apiDomain = await getApiDomain();
  // Use the standard chat completions endpoint with pipeline name as model
  const url = `${apiDomain}chat/completions`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 600_000); // 10 minutes timeout

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "generate_referrals", // Pipeline name as model
        messages: [{ role: "user", content: clientDescription }],
        stream: true,
        query: clientDescription,
        user_email: userEmail,
      }),
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
    let capturedResultId: string | undefined = undefined;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        clearTimeout(timer);
        onComplete(capturedResultId);
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
              // Content should be a JSON string representing a Resource or result_id
              try {
                const contentObj = JSON.parse(content);

                // Check if this is a result_id response
                if (contentObj.result_id) {
                  capturedResultId = contentObj.result_id;
                  console.log("Captured result_id:", capturedResultId);
                } else if (contentObj.name && contentObj.description) {
                  // This is a resource
                  onResource(contentObj as Resource);
                }
              } catch (e) {
                console.error(
                  "Failed to parse resource from content:",
                  e,
                  content,
                );
              }
            }

            // Check for finish_reason to detect completion
            if (parsed.choices?.[0]?.finish_reason === "stop") {
              clearTimeout(timer);
              onComplete(capturedResultId);
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

export async function fetchResources(
  clientDescription: string,
  userEmail: string,
  prompt_version_id: string | null,
) {
  const apiDomain = await getApiDomain();
  const url = apiDomain + "generate_referrals/run";
  const headers = {
    "Content-Type": "application/json",
  };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 600_000); // TODO make configurable
  const requestBody = prompt_version_id
    ? JSON.stringify({
        query: clientDescription,
        user_email: userEmail,
        prompt_version_id: prompt_version_id,
      })
    : JSON.stringify({
        query: clientDescription,
        user_email: userEmail,
      });

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: requestBody,
      cache: "no-store",
      signal: ac.signal,
    });

    clearTimeout(timer);

    /* eslint-disable */
    const responseData = await upstream.json(); // bypassing type enforcement due to heavy nesting within the API response
    const resultUuid: string = responseData.result.save_result.result_id;

    console.log(responseData);

    const resourcesJson = JSON.parse(
      responseData.result.llm.replies[0]._content[0].text,
    );

    console.log(resourcesJson);

    const resources = ResourcesSchema.parse(resourcesJson);
    const resourcesAsArray: Resource[] = resources.resources || [];

    console.log(resourcesAsArray);

    /* eslint-enable */

    // Check if resources array is empty
    if (resourcesAsArray.length === 0) {
      return {
        resultId: resultUuid,
        resources: [],
        errorMessage: "The API did not return any resource recommendations.",
      };
    }

    // Success, return result
    return {
      resultId: resultUuid,
      resources: resourcesAsArray,
    };
  } catch (error) {
    clearTimeout(timer);
    // Check if the error is due to timeout
    if (error instanceof Error && error.name === "AbortError") {
      return {
        resultId: "",
        resources: [],
        errorMessage: "Request timed out, please try again.",
      };
    }
  }

  // Generic error handling
  return {
    resultId: "",
    resources: [],
    errorMessage:
      "The server encountered an unexpected error. Please try again later.",
  };
}
