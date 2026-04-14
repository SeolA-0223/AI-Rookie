import { getDraftGenerationStatus } from "../generation/generateDrafts.js";
import { normalizeEnvValue } from "../sources/shared.js";

function resolveGeminiApiKey(env = process.env) {
  const keyFromKei = normalizeEnvValue(env.GEMINI_API_KEI);
  if (keyFromKei) {
    return {
      apiKey: keyFromKei,
      apiKeyEnvName: "GEMINI_API_KEI"
    };
  }

  const keyFromKey = normalizeEnvValue(env.GEMINI_API_KEY);
  if (keyFromKey) {
    return {
      apiKey: keyFromKey,
      apiKeyEnvName: "GEMINI_API_KEY"
    };
  }

  return {
    apiKey: "",
    apiKeyEnvName: null
  };
}

function readCandidateText(payload = {}) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  return candidates
    .flatMap((candidate) => candidate?.content?.parts ?? [])
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function extractJsonObject(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Gemini response did not include a JSON object.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

export async function requestGeminiJson(prompt, {
  env = process.env,
  fetchImpl = globalThis.fetch,
  temperature = 0.2
} = {}) {
  const status = getDraftGenerationStatus({ env });
  const { apiKey, apiKeyEnvName } = resolveGeminiApiKey(env);

  if (!status.enabled || typeof fetchImpl !== "function") {
    return {
      ok: false,
      value: null,
      meta: {
        provider: status.enabled ? "gemini" : "template",
        configured: status.enabled,
        usedAI: false,
        model: status.model,
        apiKeyEnvName,
        reason: status.enabled ? "fetch_unavailable" : "missing_api_key"
      }
    };
  }

  const endpoint = `${status.baseUrl}/models/${encodeURIComponent(status.model)}:generateContent`;

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature
        }
      }),
      signal: AbortSignal.timeout(20000)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini request failed with ${response.status}`);
    }

    const candidateText = readCandidateText(payload);
    if (!candidateText) {
      throw new Error("Gemini response did not include text.");
    }

    return {
      ok: true,
      value: extractJsonObject(candidateText),
      meta: {
        provider: "gemini",
        configured: true,
        usedAI: true,
        model: status.model,
        endpoint,
        apiKeyEnvName
      }
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      meta: {
        provider: "gemini",
        configured: true,
        usedAI: false,
        model: status.model,
        endpoint,
        apiKeyEnvName,
        reason: "fallback_after_error",
        error: error.message
      }
    };
  }
}
