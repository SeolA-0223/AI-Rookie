import { requestGeminiJson } from "../ai/geminiJson.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTargetLocale(value) {
  return value === "en" ? "en" : "ko";
}

function translateRiskLevel(level, targetLocale) {
  if (targetLocale !== "en") {
    return normalizeText(level);
  }

  const normalized = normalizeText(level).toLowerCase();
  if (["빨강", "red", "high"].includes(normalized)) {
    return "high";
  }
  if (["노랑", "yellow", "medium"].includes(normalized)) {
    return "medium";
  }
  if (["파랑", "blue", "low"].includes(normalized)) {
    return "low";
  }
  return normalized || "medium";
}

function normalizeLocalizedIssue(issue = {}, fallbackIndex = 0) {
  return {
    section: normalizeText(issue.section) || `Issue ${fallbackIndex + 1}`,
    severity: translateRiskLevel(issue.severity, "en"),
    problem: normalizeText(issue.problem),
    ordinanceBasis: normalizeText(issue.ordinanceBasis),
    suggestion: normalizeText(issue.suggestion)
  };
}

function appendLocaleSuffix(fileName, locale) {
  const normalizedName = normalizeText(fileName);
  if (!normalizedName || locale !== "en") {
    return normalizedName;
  }

  const lastDotIndex = normalizedName.lastIndexOf(".");
  if (lastDotIndex <= 0) {
    return `${normalizedName}-${locale}`;
  }

  return `${normalizedName.slice(0, lastDotIndex)}-${locale}${normalizedName.slice(lastDotIndex)}`;
}

function fallbackTextLocalization(documentText, targetLocale) {
  return {
    locale: normalizeTargetLocale(targetLocale),
    translatedDocumentText: normalizeText(documentText),
    ai: {
      provider: "template",
      configured: false,
      usedAI: false,
      reason: "translation_not_available"
    }
  };
}

function fallbackInspectionLocalization({ inspectionResult, documentText, targetLocale }) {
  const locale = normalizeTargetLocale(targetLocale);
  return {
    locale,
    translatedDocumentText: normalizeText(documentText),
    detection: {
      reasoning: normalizeText(inspectionResult?.detection?.reasoning)
    },
    review: {
      reasoning: normalizeText(inspectionResult?.review?.reasoning),
      summary: normalizeText(inspectionResult?.review?.summary),
      riskLevel: translateRiskLevel(inspectionResult?.review?.riskLevel, locale),
      issues: Array.isArray(inspectionResult?.review?.issues)
        ? inspectionResult.review.issues.map((issue, index) => normalizeLocalizedIssue(issue, index))
        : [],
      checklist: Array.isArray(inspectionResult?.review?.checklist)
        ? inspectionResult.review.checklist.map((item) => normalizeText(item)).filter(Boolean)
        : [],
      revisedDraft: normalizeText(inspectionResult?.review?.revisedDraft)
    },
    download: {
      ...(inspectionResult?.download ?? {}),
      fileName: appendLocaleSuffix(inspectionResult?.download?.fileName, locale),
      content: normalizeText(inspectionResult?.download?.content)
    },
    ai: {
      provider: "template",
      configured: false,
      usedAI: false,
      reason: "translation_not_available"
    }
  };
}

function buildDocumentTextTranslationPrompt(documentText, targetLocale) {
  return [
    "You translate municipal working documents into clear English.",
    `Target locale: ${normalizeTargetLocale(targetLocale)}`,
    "Return JSON only with this key:",
    "translatedDocumentText",
    "Requirements:",
    "- Preserve headings, bullets, numbering, and line breaks when reasonable.",
    "- Keep ordinance IDs, dates, URLs, and numeric thresholds unchanged.",
    "- Translate the document into natural English.",
    "",
    "Document text:",
    documentText
  ].join("\n");
}

function buildInspectionLocalizationPrompt({ inspectionResult, documentText, targetLocale }) {
  return [
    "You translate a Korean ordinance review result into clear English.",
    `Target locale: ${normalizeTargetLocale(targetLocale)}`,
    "Return JSON only with these keys:",
    "translatedDocumentText, detectionReasoning, reviewReasoning, summary, issues, checklist, revisedDraft, downloadMarkdown",
    "issues must be an array of objects with keys:",
    "section, severity, problem, ordinanceBasis, suggestion",
    "Requirements:",
    "- Translate all prose into English.",
    "- Keep ordinance IDs, dates, URLs, and numeric thresholds unchanged.",
    "- severity must be one of: high, medium, low.",
    "- revisedDraft must remain a usable document draft, not just bullets.",
    "- downloadMarkdown must be a complete English markdown report.",
    "",
    "Original document text:",
    documentText,
    "",
    "Inspection result JSON:",
    JSON.stringify({
      detection: inspectionResult?.detection ?? {},
      ordinance: inspectionResult?.ordinance ?? {},
      review: inspectionResult?.review ?? {},
      download: inspectionResult?.download ?? {}
    }, null, 2)
  ].join("\n");
}

export async function localizeDocumentText(
  {
    documentText,
    targetLocale = "en"
  },
  {
    env = process.env,
    fetchImpl = globalThis.fetch
  } = {}
) {
  const normalizedText = normalizeText(documentText);
  const locale = normalizeTargetLocale(targetLocale);

  if (!normalizedText || locale !== "en") {
    return fallbackTextLocalization(normalizedText, locale);
  }

  const aiResult = await requestGeminiJson(buildDocumentTextTranslationPrompt(normalizedText, locale), {
    env,
    fetchImpl,
    temperature: 0.1
  });

  const translatedDocumentText = normalizeText(aiResult.value?.translatedDocumentText);
  if (!translatedDocumentText) {
    return fallbackTextLocalization(normalizedText, locale);
  }

  return {
    locale,
    translatedDocumentText,
    ai: aiResult.meta
  };
}

export async function localizeDocumentInspection(
  {
    inspectionResult,
    documentText,
    targetLocale = "en"
  },
  {
    env = process.env,
    fetchImpl = globalThis.fetch
  } = {}
) {
  const normalizedText = normalizeText(documentText);
  const locale = normalizeTargetLocale(targetLocale);

  if (!inspectionResult || typeof inspectionResult !== "object" || locale !== "en") {
    return fallbackInspectionLocalization({
      inspectionResult,
      documentText: normalizedText,
      targetLocale: locale
    });
  }

  const fallback = fallbackInspectionLocalization({
    inspectionResult,
    documentText: normalizedText,
    targetLocale: locale
  });

  const aiResult = await requestGeminiJson(
    buildInspectionLocalizationPrompt({
      inspectionResult,
      documentText: normalizedText,
      targetLocale: locale
    }),
    {
      env,
      fetchImpl,
      temperature: 0.1
    }
  );

  const payload = aiResult.value && typeof aiResult.value === "object" ? aiResult.value : {};
  const issues = Array.isArray(payload.issues)
    ? payload.issues.map((issue, index) => normalizeLocalizedIssue(issue, index))
    : fallback.review.issues;
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist.map((item) => normalizeText(item)).filter(Boolean)
    : fallback.review.checklist;

  return {
    locale,
    translatedDocumentText: normalizeText(payload.translatedDocumentText) || fallback.translatedDocumentText,
    detection: {
      reasoning: normalizeText(payload.detectionReasoning) || fallback.detection.reasoning
    },
    review: {
      reasoning: normalizeText(payload.reviewReasoning) || fallback.review.reasoning,
      summary: normalizeText(payload.summary) || fallback.review.summary,
      riskLevel: fallback.review.riskLevel,
      issues,
      checklist,
      revisedDraft: normalizeText(payload.revisedDraft) || fallback.review.revisedDraft
    },
    download: {
      ...(inspectionResult?.download ?? {}),
      fileName: appendLocaleSuffix(inspectionResult?.download?.fileName, locale) || fallback.download.fileName,
      content: normalizeText(payload.downloadMarkdown) || fallback.download.content
    },
    ai: aiResult.meta
  };
}
