import { requestGeminiJson } from "../ai/geminiJson.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTargetLocale(value) {
  return value === "en" ? "en" : "ko";
}

function cloneJsonValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function buildResultIdentity(result = {}, fallbackIndex = 0) {
  return [
    normalizeText(result.id) || `row-${fallbackIndex}`,
    normalizeText(result.effectiveDate),
    normalizeText(result.promulgationDate),
    normalizeText(result.referenceUrl),
    result.current === true ? "Y" : result.current === false ? "N" : ""
  ].join("|");
}

function buildResultTranslationPrompt({ mode, results, recommendation, targetLocale }) {
  return [
    "You translate Korean municipal ordinance search results into clear English.",
    `Target locale: ${normalizeTargetLocale(targetLocale)}`,
    `Mode: ${mode}`,
    "Return JSON only with these keys:",
    "results, recommendationReason",
    "results must be an array of objects with these keys:",
    "id, title, jurisdiction, summary, effectiveDate, promulgationDate, referenceUrl, current",
    "Requirements:",
    "- Preserve result order.",
    "- Keep ids, dates, URLs, ordinance numbers, and municipality codes unchanged.",
    "- Translate titles, jurisdiction names, and summaries into natural English.",
    "- If a field is already English, keep it readable and unchanged.",
    "- recommendationReason should be a short English sentence only when recommendation is provided.",
    "",
    "Source payload JSON:",
    JSON.stringify({ results, recommendation }, null, 2)
  ].join("\n");
}

function buildFallbackLocalization({ mode, results, recommendation, targetLocale }) {
  return {
    locale: normalizeTargetLocale(targetLocale),
    mode,
    results: cloneJsonValue(Array.isArray(results) ? results : []),
    recommendation: recommendation ? cloneJsonValue(recommendation) : null,
    ai: {
      provider: "template",
      configured: false,
      usedAI: false,
      reason: "translation_not_available"
    }
  };
}

function normalizeLocalizedResult(rawResult = {}, localizedResult = {}) {
  return {
    ...rawResult,
    title: normalizeText(localizedResult.title) || rawResult.title,
    jurisdiction: normalizeText(localizedResult.jurisdiction) || rawResult.jurisdiction,
    summary: normalizeText(localizedResult.summary) || rawResult.summary,
    effectiveDate: normalizeText(localizedResult.effectiveDate) || rawResult.effectiveDate,
    promulgationDate: normalizeText(localizedResult.promulgationDate) || rawResult.promulgationDate,
    referenceUrl: normalizeText(localizedResult.referenceUrl) || rawResult.referenceUrl,
    current:
      typeof localizedResult.current === "boolean"
        ? localizedResult.current
        : typeof rawResult.current === "boolean"
          ? rawResult.current
          : rawResult.current
  };
}

function matchLocalizedResult(rawResult, localizedResults = [], fallbackIndex = 0) {
  const rawIdentity = buildResultIdentity(rawResult, fallbackIndex);
  const byIdentity = localizedResults.find((candidate, index) => buildResultIdentity(candidate, index) === rawIdentity);
  if (byIdentity) {
    return byIdentity;
  }

  const rawId = normalizeText(rawResult.id);
  if (rawId) {
    const byId = localizedResults.find((candidate) => normalizeText(candidate.id) === rawId);
    if (byId) {
      return byId;
    }
  }

  return localizedResults[fallbackIndex] ?? null;
}

function localizeRecommendationWithResults(rawRecommendation, localizedResults = []) {
  if (!rawRecommendation?.before || !rawRecommendation?.after) {
    return rawRecommendation ? cloneJsonValue(rawRecommendation) : null;
  }

  const before = normalizeLocalizedResult(
    rawRecommendation.before,
    matchLocalizedResult(rawRecommendation.before, localizedResults) ?? {}
  );
  const after = normalizeLocalizedResult(
    rawRecommendation.after,
    matchLocalizedResult(rawRecommendation.after, localizedResults) ?? {}
  );

  return {
    ...rawRecommendation,
    before,
    after
  };
}

export async function localizeSourcePayload(
  {
    mode,
    results,
    recommendation = null,
    targetLocale = "en"
  },
  {
    env = process.env,
    fetchImpl = globalThis.fetch
  } = {}
) {
  const normalizedMode = mode === "discover-results" ? "discover-results" : "search-results";
  const normalizedResults = Array.isArray(results) ? results : [];
  const locale = normalizeTargetLocale(targetLocale);
  const fallback = buildFallbackLocalization({
    mode: normalizedMode,
    results: normalizedResults,
    recommendation,
    targetLocale: locale
  });

  if (locale !== "en" || normalizedResults.length === 0) {
    return fallback;
  }

  const aiResult = await requestGeminiJson(
    buildResultTranslationPrompt({
      mode: normalizedMode,
      results: normalizedResults,
      recommendation,
      targetLocale: locale
    }),
    {
      env,
      fetchImpl,
      temperature: 0.1
    }
  );

  const localizedResultsPayload = Array.isArray(aiResult.value?.results) ? aiResult.value.results : [];
  const localizedResults = normalizedResults.map((result, index) =>
    normalizeLocalizedResult(result, matchLocalizedResult(result, localizedResultsPayload, index) ?? {})
  );
  const localizedRecommendation = localizeRecommendationWithResults(recommendation, localizedResults);
  if (localizedRecommendation) {
    localizedRecommendation.reason = normalizeText(aiResult.value?.recommendationReason) || localizedRecommendation.reason;
  }

  return {
    locale,
    mode: normalizedMode,
    results: localizedResults,
    recommendation: localizedRecommendation,
    ai: aiResult.meta?.usedAI ? aiResult.meta : fallback.ai
  };
}
