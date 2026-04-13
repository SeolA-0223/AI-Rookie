const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const REQUIRED_DRAFT_KEYS = ["internalNoticeDraft", "citizenGuideDraft", "faqDraft", "comparisonTable"];

function lineForChange(change) {
  return `- [${change.changeType}] ${change.title}: ${change.beforeText ?? "(none)"} -> ${change.afterText ?? "(none)"}`;
}

function buildComparisonTable(changes) {
  const header = "| Type | Clause | Before | After |\n|---|---|---|---|";
  const rows = changes.map(
    (change) => `| ${change.changeType} | ${change.title} | ${change.beforeText ?? ""} | ${change.afterText ?? ""} |`
  );
  return [header, ...rows].join("\n");
}

export function generateDrafts(changes, riskRows) {
  const changeLines = changes.map(lineForChange).join("\n");
  const highRisk = riskRows.filter((item) => item.risk.level === "빨강");

  const internalNoticeDraft = [
    "[Internal Notice Draft]",
    "",
    "The following policy changes were detected:",
    changeLines,
    "",
    `High risk items: ${highRisk.length}`
  ].join("\n");

  const citizenGuideDraft = [
    "[Citizen Guide Update Draft]",
    "",
    "Please review and apply these updates:",
    changeLines
  ].join("\n");

  const faqDraft = [
    "[FAQ Update Draft]",
    "",
    "Q: What changed?",
    "A: See summarized changes below.",
    changeLines
  ].join("\n");

  return {
    internalNoticeDraft,
    citizenGuideDraft,
    faqDraft,
    comparisonTable: buildComparisonTable(changes)
  };
}

function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

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

export function getDraftGenerationStatus({ env = process.env } = {}) {
  const { apiKey, apiKeyEnvName } = resolveGeminiApiKey(env);
  const model = normalizeEnvValue(env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;
  const baseUrl = normalizeEnvValue(env.GEMINI_BASE_URL) || DEFAULT_GEMINI_BASE_URL;

  return {
    provider: apiKey ? "gemini" : "template",
    enabled: Boolean(apiKey),
    model,
    baseUrl,
    apiKeyEnvName,
    missingEnv: apiKey ? [] : ["GEMINI_API_KEI"]
  };
}

function buildPrompt(changes, riskRows) {
  return [
    "You generate follow-up drafts for municipal ordinance changes.",
    "Return JSON only with these string keys:",
    "internalNoticeDraft, citizenGuideDraft, faqDraft, comparisonTable",
    "Requirements:",
    "- Write in Korean.",
    "- Base the drafts only on the provided change and risk data.",
    "- Keep the comparisonTable as a markdown table with header: | Type | Clause | Before | After |",
    "- If a detail is uncertain, ask the reviewer to verify it instead of inventing facts.",
    "",
    "Change data:",
    JSON.stringify({ changes, riskRows }, null, 2)
  ].join("\n");
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
    throw new Error("Gemini draft response did not include a JSON object.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function mergeDraftsWithFallback(parsed, fallbackDrafts) {
  const drafts = {};
  const fallbackSections = [];

  for (const key of REQUIRED_DRAFT_KEYS) {
    const value = typeof parsed?.[key] === "string" ? parsed[key].trim() : "";
    if (value) {
      drafts[key] = value;
      continue;
    }

    drafts[key] = fallbackDrafts[key];
    fallbackSections.push(key);
  }

  return {
    drafts,
    fallbackSections
  };
}

function createGeminiRequestBody(changes, riskRows) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildPrompt(changes, riskRows)
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  };
}

export async function generateDraftsWithConfiguredAI(
  changes,
  riskRows,
  {
    env = process.env,
    fetchImpl = globalThis.fetch,
    fallbackDrafts = generateDrafts(changes, riskRows)
  } = {}
) {
  const status = getDraftGenerationStatus({ env });
  const { apiKey, apiKeyEnvName } = resolveGeminiApiKey(env);

  if (!status.enabled || typeof fetchImpl !== "function") {
    return {
      drafts: fallbackDrafts,
      meta: {
        provider: "template",
        configured: false,
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
      body: JSON.stringify(createGeminiRequestBody(changes, riskRows)),
      signal: AbortSignal.timeout(20000)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini request failed with ${response.status}`);
    }

    const candidateText = readCandidateText(payload);
    if (!candidateText) {
      throw new Error("Gemini response did not include draft text.");
    }

    const parsed = extractJsonObject(candidateText);
    const { drafts, fallbackSections } = mergeDraftsWithFallback(parsed, fallbackDrafts);

    return {
      drafts,
      meta: {
        provider: "gemini",
        configured: true,
        usedAI: true,
        model: status.model,
        endpoint,
        apiKeyEnvName,
        fallbackSections
      }
    };
  } catch (error) {
    return {
      drafts: fallbackDrafts,
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
