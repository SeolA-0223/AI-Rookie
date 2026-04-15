import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  discoverLawSource,
  readLawSourceDocument,
  recommendLawSourcePair,
  searchLawSource,
  SourceResolutionError
} from "../sources/lawSource.js";
import { LAW_GO_MUNICIPALITIES, getMunicipalityNames, normalizeMunicipalityCodes } from "../sources/providers/lawGoMunicipalities.js";
import { requestGeminiJson } from "../ai/geminiJson.js";

const DEFAULT_PROVIDER = "law-go-public";
const MAX_DOCUMENT_CHARS = 20000;
const MAX_ORDINANCE_CONTEXT_CHARS = 12000;
const MAX_ORDINANCE_CLAUSES = 12;
const TITLE_STOP_WORDS = new Set(["조례", "규칙", "기본", "안내문", "가이드", "문서", "ordinance", "rule", "guide"]);
const DAEJEON_DONGGU_REFERENCE_FILE = fileURLToPath(
  new URL("../../../data/reference-documents/daejeon_donggu_youth_basic_ordinance_latest.json", import.meta.url)
);
const BUNDLED_ORDINANCE_FALLBACKS = [
  {
    fallbackId: "daejeon_donggu_youth_basic_ordinance",
    title: "대전광역시 동구 청년 기본 조례",
    aliases: [
      "대전광역시 동구 청년 기본 조례",
      "대전 동구 청년 기본 조례",
      "동구 청년 기본 조례"
    ],
    filePath: DAEJEON_DONGGU_REFERENCE_FILE
  }
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDocumentText(value) {
  return normalizeText(value).replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function buildInspectionInputError(path, message) {
  return new SourceResolutionError({
    code: "SOURCE_INPUT_INVALID",
    message: "Document inspection request is invalid.",
    details: [
      {
        path,
        message
      }
    ],
    statusCode: 400
  });
}

function buildInspectionResolutionError(message) {
  return new SourceResolutionError({
    code: "SOURCE_FETCH_FAILED",
    message,
    statusCode: 502
  });
}

function tokenize(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function normalizeLookupText(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function cleanOrdinanceTitleHint(value) {
  return normalizeText(value)
    .replace(/^#+\s*/, "")
    .replace(/\((?:테스트용|초안|예시)\)\s*$/u, "")
    .replace(/\b(?:안내문|안내서|가이드|테스트용|초안)\b.*$/u, "")
    .trim();
}

function cleanDetectedOrdinanceTitleHint(value) {
  return normalizeText(value)
    .replace(/^#+\s*/, "")
    .replace(/\((?:테스트용|초안|예시)\)\s*$/u, "")
    .replace(/\s*(?:안내문|안내서|가이드|공지|테스트용|초안)\s*$/u, "")
    .trim();
}

function looksLikeExplicitOrdinanceLine(value) {
  return /(?:조례|규칙|ordinance|rule)/iu.test(normalizeText(value));
}

function looksLikeOrdinanceContextLine(value) {
  return /(?:청년|지원|신청|자격|운영|안내|혜택|기준)/u.test(normalizeText(value));
}

function summarizeClause(clause = {}, maxLength = 220) {
  const text = normalizeText(clause.text).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function shorten(value, maxLength = 200) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function sanitizeFileStem(value) {
  return normalizeText(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function buildMarkdownDownload({ fileName, ordinance, detection, review }) {
  const issueLines = (review.issues ?? []).map((issue, index) =>
    `${index + 1}. [${issue.severity}] ${issue.section}: ${issue.problem}\n   - 근거: ${issue.ordinanceBasis}\n   - 수정: ${issue.suggestion}`
  );
  const checklistLines = (review.checklist ?? []).map((item, index) => `${index + 1}. ${item}`);

  return [
    `# 문서 검사 결과 - ${normalizeText(fileName) || "입력 문서"}`,
    "",
    "## 판정된 최신 조례",
    `- 조례명: ${ordinance.matched?.title ?? "미확인"}`,
    `- 지자체: ${ordinance.matched?.jurisdiction ?? "미확인"}`,
    `- 조례 ID: ${ordinance.matched?.id ?? "미확인"}`,
    `- 공포일: ${ordinance.matched?.promulgationDate ?? "미확인"}`,
    `- 시행일: ${ordinance.matched?.effectiveDate ?? "미확인"}`,
    `- 출처: ${ordinance.matched?.referenceUrl ?? "미확인"}`,
    "",
    "## 적용 판단",
    review.summary ?? "요약 없음",
    "",
    "## AI 판정 메모",
    detection.reasoning ?? "판정 메모 없음",
    "",
    "## 수정 필요 항목",
    ...(issueLines.length > 0 ? issueLines : ["- 없음"]),
    "",
    "## 검토 체크리스트",
    ...(checklistLines.length > 0 ? checklistLines : ["- 없음"]),
    "",
    "## 수정본 초안",
    review.revisedDraft ?? "수정본 초안 없음"
  ].join("\n");
}

function buildHeuristicDetection(documentText, requestedMunicipalities = []) {
  const lines = documentText
    .split(/\n+/)
    .map((line) => cleanOrdinanceTitleHint(line))
    .filter(Boolean);

  const ordinanceLineCandidates = lines.filter((line) => /(조례|규칙|ordinance|rule)/i.test(line));
  const titleCandidate =
    ordinanceLineCandidates.sort((left, right) => right.length - left.length)[0] ||
    lines.find((line) => /청년|지원|신청|자격|운영|안내/.test(line)) ||
    "지자체 조례";

  const municipalityHints = unique([
    ...requestedMunicipalities,
    ...LAW_GO_MUNICIPALITIES.filter((item) => documentText.includes(item.name)).map((item) => item.name)
  ]);

  return {
    ordinanceTitleQuery: titleCandidate,
    hasExplicitOrdinanceLine: ordinanceLineCandidates.length > 0,
    municipalityHints,
    keywords: unique(tokenize(titleCandidate).slice(0, 8)),
    reasoning: "문서 본문에서 조례명 후보와 지자체명을 단순 추출한 규칙 기반 판정입니다.",
    confidence: municipalityHints.length > 0 && ordinanceLineCandidates.length > 0 ? "medium" : "low",
    documentType: /안내|공지/.test(documentText) ? "guide" : "document"
  };
}

function buildHeuristicDetectionV2(documentText, requestedMunicipalities = []) {
  const rawLines = documentText
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
  const lines = rawLines.map((line) => cleanDetectedOrdinanceTitleHint(line)).filter(Boolean);

  const rawOrdinanceLineCandidates = rawLines.filter((line) => looksLikeExplicitOrdinanceLine(line));
  const rawTitleCandidate =
    rawOrdinanceLineCandidates.sort((left, right) => right.length - left.length)[0] ||
    rawLines.find((line) => looksLikeOrdinanceContextLine(line)) ||
    rawLines[0] ||
    "지자체 조례";
  const titleCandidate = cleanDetectedOrdinanceTitleHint(rawTitleCandidate);
  const municipalityHints = unique([
    ...requestedMunicipalities,
    ...LAW_GO_MUNICIPALITIES.filter((item) => documentText.includes(item.name)).map((item) => item.name)
  ]);
  const keywords = unique([
    ...getMeaningfulTitleTokens(titleCandidate, municipalityHints),
    ...tokenize(titleCandidate)
  ]).slice(0, 8);

  return {
    ordinanceTitleQuery: rawTitleCandidate,
    hasExplicitOrdinanceLine: rawOrdinanceLineCandidates.length > 0,
    municipalityHints,
    keywords,
    reasoning: "문서 본문에서 조례명 후보와 지자체명을 우선 추출한 규칙 기반 판정입니다.",
    confidence: municipalityHints.length > 0 && rawOrdinanceLineCandidates.length > 0 ? "medium" : "low",
    documentType: /(?:안내|공지|가이드)/u.test(documentText) ? "guide" : "document"
  };
}

function buildDetectionPrompt(documentText, requestedMunicipalityNames = []) {
  return [
    "You identify the most likely Korean municipal ordinance that governs a document.",
    "Return JSON only with these keys:",
    "ordinanceTitleQuery, municipalityHints, keywords, reasoning, confidence, documentType",
    "Requirements:",
    "- Write the ordinanceTitleQuery in Korean.",
    "- municipalityHints must be an array of municipality names in Korean when inferable.",
    "- keywords must be a short array of Korean search keywords.",
    "- Do not invent an exact ordinance title unless the document strongly implies it.",
    "",
    `Requested municipality hints: ${JSON.stringify(requestedMunicipalityNames)}`,
    "",
    "Document text:",
    documentText
  ].join("\n");
}

function buildClauseContext(documentText, clauses = []) {
  const documentTokens = new Set(tokenize(documentText));
  const scoredClauses = clauses.map((clause, index) => {
    const clauseTokens = tokenize(`${clause.title} ${clause.text}`);
    const overlap = clauseTokens.filter((token) => documentTokens.has(token)).length;

    return {
      clause,
      index,
      overlap
    };
  });

  const rankedClauses = scoredClauses
    .sort((left, right) => {
      if (left.overlap !== right.overlap) {
        return right.overlap - left.overlap;
      }

      return left.index - right.index;
    })
    .slice(0, MAX_ORDINANCE_CLAUSES)
    .map((entry) => entry.clause);

  const selectedClauses = rankedClauses.length > 0 ? rankedClauses : clauses.slice(0, MAX_ORDINANCE_CLAUSES);
  const lines = [];
  let totalChars = 0;

  for (const clause of selectedClauses) {
    const line = `- ${clause.title}: ${summarizeClause(clause, 400)}`;
    if (totalChars + line.length > MAX_ORDINANCE_CONTEXT_CHARS) {
      break;
    }
    lines.push(line);
    totalChars += line.length;
  }

  return lines.join("\n");
}

function buildComparisonPrompt({
  documentText,
  ordinance,
  clauseContext,
  detection
}) {
  return [
    "You review a municipal working document against the latest ordinance.",
    "Return JSON only with these keys:",
    "summary, reasoning, riskLevel, issues, checklist, revisedDraft",
    "issues must be an array of objects with keys: section, severity, problem, ordinanceBasis, suggestion.",
    "checklist must be an array of short Korean action items.",
    "Requirements:",
    "- Write everything in Korean.",
    "- Explain concrete mismatches or outdated statements in the document.",
    "- Base claims only on the provided document and ordinance context.",
    "- summary must name the most important sections or criteria that need revision.",
    "- reasoning must explain why the ordinance applies and which clauses were compared.",
    "- riskLevel must be one of: high, medium, low.",
    "- Quote or paraphrase the document sentence that appears outdated when possible.",
    "- revisedDraft must be a usable revised document draft, not only bullet points.",
    "- If the evidence is weak, say verification is needed.",
    "",
    `Detected ordinance query: ${detection.ordinanceTitleQuery}`,
    `Detected reasoning: ${detection.reasoning}`,
    "",
    "Latest ordinance metadata:",
    JSON.stringify({
      id: ordinance.matched?.id,
      title: ordinance.matched?.title,
      jurisdiction: ordinance.matched?.jurisdiction,
      promulgationDate: ordinance.matched?.promulgationDate,
      effectiveDate: ordinance.matched?.effectiveDate,
      referenceUrl: ordinance.matched?.referenceUrl
    }, null, 2),
    "",
    "Latest ordinance clause excerpts:",
    clauseContext,
    "",
    "Document text:",
    documentText
  ].join("\n");
}

function normalizeIssue(issue = {}, fallbackIndex = 0) {
  return {
    section: normalizeText(issue.section) || `검토 항목 ${fallbackIndex + 1}`,
    severity: normalizeText(issue.severity) || "medium",
    problem: normalizeText(issue.problem) || "최신 조례 반영 여부를 재검토해야 합니다.",
    ordinanceBasis: normalizeText(issue.ordinanceBasis) || "조례 원문 확인 필요",
    suggestion: normalizeText(issue.suggestion) || "최신 조례 기준에 맞게 문구를 수정하세요."
  };
}

function buildHeuristicReview({ documentText, ordinance, detection }) {
  const clauses = Array.isArray(ordinance.document?.clauses) ? ordinance.document.clauses.slice(0, 5) : [];
  const issues = clauses.map((clause, index) => ({
    section: clause.title || `조항 ${index + 1}`,
    severity: index === 0 ? "high" : "medium",
    problem: "입력 문서에서 이 조항 기준이 최신 조례와 일치하는지 확인이 필요합니다.",
    ordinanceBasis: `${clause.title}: ${summarizeClause(clause, 180)}`,
    suggestion: `${clause.title} 관련 설명과 기준값을 최신 조례 문구로 다시 정리하세요.`
  }));

  const checklist = unique([
    `${ordinance.matched?.title ?? "최신 조례"} 적용 대상과 범위를 다시 확인하기`,
    "신청 자격, 제출 서류, 처리 기한, 지원 금액 표현 점검하기",
    "시민 안내문과 내부 업무 문서의 기준값을 동일하게 맞추기"
  ]);

  const revisedDraft = [
    `${ordinance.matched?.title ?? "최신 조례"} 반영 수정 초안`,
    "",
    "아래 초안은 최신 조례 반영을 위한 검토용 문안입니다.",
    "",
    documentText,
    "",
    "검토 메모:",
    ...issues.map((issue) => `- ${issue.section}: ${issue.suggestion}`)
  ].join("\n");

  return {
    summary: `최신 조례인 ${ordinance.matched?.title ?? "관련 조례"}를 기준으로 문서를 재검토해야 합니다. 현재는 규칙 기반 fallback 결과입니다.`,
    riskLevel: "medium",
    issues,
    checklist,
    revisedDraft,
    reasoning: detection.reasoning
  };
}

function splitDocumentSegments(documentText) {
  return cleanDocumentText(documentText)
    .split(/\n{2,}/)
    .flatMap((block) => block.split(/\n/))
    .map((segment) => normalizeText(segment))
    .filter((segment) => segment.length >= 8)
    .slice(0, 40);
}

function extractComparableValues(text) {
  return unique((normalizeText(text).match(/\d+(?:\.\d+)?/g) ?? []).map((value) => value.trim()));
}

function scoreSegmentAgainstClause(segment, clause) {
  const clauseTokens = unique(tokenize(`${clause.title} ${clause.text}`));
  const segmentTokens = new Set(tokenize(segment));
  const keywordOverlap = clauseTokens.filter((token) => segmentTokens.has(token)).length;
  const clauseNumbers = extractComparableValues(`${clause.title} ${clause.text}`);
  const segmentNumbers = new Set(extractComparableValues(segment));
  const numberOverlap = clauseNumbers.filter((value) => segmentNumbers.has(value)).length;
  const titleBoost = normalizeLookupText(segment).includes(normalizeLookupText(clause.title)) ? 3 : 0;

  return keywordOverlap * 2 + numberOverlap * 3 + titleBoost;
}

function findBestDocumentEvidence(documentText, clause) {
  const segments = splitDocumentSegments(documentText);
  let bestMatch = null;

  for (const segment of segments) {
    const score = scoreSegmentAgainstClause(segment, clause);
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        text: segment,
        score
      };
    }
  }

  return bestMatch && bestMatch.score > 0 ? bestMatch : null;
}

function inferIssueSeverity(clause, evidence) {
  const clauseText = `${clause.title ?? ""} ${clause.text ?? ""}`;
  if (/(연령|나이|자격|대상|지원금|금액|기간|기한|신청|제출|서류)/u.test(clauseText)) {
    return evidence?.score >= 4 ? "high" : "medium";
  }

  return evidence?.score >= 6 ? "high" : evidence?.score >= 3 ? "medium" : "low";
}

function buildEnhancedHeuristicIssue(documentText, clause, index) {
  const section = normalizeText(clause.title) || `조항 ${index + 1}`;
  const evidence = findBestDocumentEvidence(documentText, clause);
  const evidenceSnippet = evidence?.text ? shorten(evidence.text, 110) : "";
  const keyValues = extractComparableValues(`${clause.title} ${clause.text}`).slice(0, 3);
  const problem = evidenceSnippet
    ? `문서의 "${evidenceSnippet}" 문장이 최신 조례의 ${section} 기준과 다른지 확인이 필요합니다.`
    : `${section} 관련 최신 기준이 문서에 반영되었는지 검토가 필요합니다.`;
  const ordinanceBasis = evidenceSnippet
    ? `${section}: ${summarizeClause(clause, 180)} / 문서 근거: ${evidenceSnippet}`
    : `${section}: ${summarizeClause(clause, 180)}`;
  const suggestion = evidenceSnippet
    ? `문서의 해당 문장을 최신 조례 문구${keyValues.length ? `와 핵심 수치(${keyValues.join(", ")})` : ""}에 맞게 다시 작성하세요.`
    : `${section} 관련 안내를 최신 조례 문구와 기준에 맞게 보강하세요.`;

  return {
    section,
    severity: inferIssueSeverity(clause, evidence),
    problem,
    ordinanceBasis,
    suggestion,
    score: evidence?.score ?? 0
  };
}

function buildEnhancedHeuristicSummary(ordinance, issues = []) {
  const title = ordinance.matched?.title ?? "최신 조례";
  const sections = issues.slice(0, 3).map((issue) => issue.section).filter(Boolean);

  if (!sections.length) {
    return `${title} 기준으로 문서를 검토했습니다. 핵심 조항 반영 여부를 추가 확인해야 합니다.`;
  }

  return `${title} 기준으로 문서를 비교한 결과 ${sections.join(", ")} 항목에서 최신 기준 반영 여부를 우선 확인해야 합니다.`;
}

function buildEnhancedHeuristicReasoning(detection, ordinance, issues = []) {
  const title = ordinance.matched?.title ?? detection.ordinanceTitleQuery ?? "관련 조례";
  const sections = issues.slice(0, 2).map((issue) => issue.section).filter(Boolean);
  const hintText = detection.municipalityHints?.length
    ? `${detection.municipalityHints.join(", ")} 지자체 힌트와 문서 제목/본문 키워드`
    : "문서 제목과 본문 키워드";

  if (!sections.length) {
    return `${hintText}를 바탕으로 ${title}를 적용 조례로 판단했고, 최신 조항 반영 여부를 검토했습니다.`;
  }

  return `${hintText}를 바탕으로 ${title}를 적용 조례로 판단했고, ${sections.join(", ")} 조항을 중심으로 문서 문장과 최신 기준을 대조했습니다.`;
}

function buildHeuristicReviewEnhanced({ documentText, ordinance, detection }) {
  const clauses = Array.isArray(ordinance.document?.clauses) ? ordinance.document.clauses.slice(0, 6) : [];
  const rankedIssues = clauses
    .map((clause, index) => buildEnhancedHeuristicIssue(documentText, clause, index))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
  const issues = rankedIssues.map(({ score, ...issue }) => issue);
  const topSections = issues.slice(0, 3).map((issue) => issue.section);
  const checklist = unique([
    `${ordinance.matched?.title ?? "최신 조례"} 적용 대상과 범위를 다시 확인하기`,
    topSections.length > 0 ? `${topSections.join(", ")} 안내 문장을 최신 기준으로 수정하기` : "",
    "연령, 자격, 제출 서류, 신청 기한, 지원 금액 등 수치와 조건 다시 점검하기",
    "시민 안내문과 내부 문서의 표현을 동일한 최신 기준으로 맞추기"
  ].filter(Boolean));

  const revisedDraft = [
    `${ordinance.matched?.title ?? "최신 조례"} 반영 수정 초안`,
    "",
    "아래 초안은 최신 조례 반영을 위한 검토용 문안입니다.",
    "",
    documentText,
    "",
    "검토 메모:",
    ...issues.map((issue) => `- ${issue.section}: ${issue.suggestion}`)
  ].join("\n");

  return {
    summary: buildEnhancedHeuristicSummary(ordinance, issues),
    reasoning: buildEnhancedHeuristicReasoning(detection, ordinance, issues),
    riskLevel: issues.some((issue) => issue.severity === "high") ? "high" : "medium",
    issues,
    checklist,
    revisedDraft
  };
}

function getMeaningfulTitleTokens(title, municipalityNames = []) {
  const ignoredTokens = new Set([
    ...TITLE_STOP_WORDS,
    ...municipalityNames.flatMap((name) => tokenize(name))
  ]);

  return unique(tokenize(title).filter((token) => token.length >= 2 && !ignoredTokens.has(token)));
}

function shouldPreferHeuristicTitle({ heuristicTitle, detectedTitle, municipalityNames = [] }) {
  const normalizedHeuristicTitle = normalizeText(heuristicTitle);
  const normalizedDetectedTitle = normalizeText(detectedTitle);

  if (!normalizedHeuristicTitle || !normalizedDetectedTitle) {
    return false;
  }

  const heuristicTokens = getMeaningfulTitleTokens(normalizedHeuristicTitle, municipalityNames);
  const detectedTokenSet = new Set(getMeaningfulTitleTokens(normalizedDetectedTitle, municipalityNames));
  const overlap = heuristicTokens.filter((token) => detectedTokenSet.has(token)).length;

  return heuristicTokens.length > 0 && detectedTokenSet.size > 0 && overlap === 0;
}

function parseInspectionResultTimestamp(result = {}) {
  const effectiveTimestamp = Date.parse(normalizeText(result?.effectiveDate));
  const promulgationTimestamp = Date.parse(normalizeText(result?.promulgationDate));
  return Math.max(
    Number.isFinite(effectiveTimestamp) ? effectiveTimestamp : 0,
    Number.isFinite(promulgationTimestamp) ? promulgationTimestamp : 0
  );
}

function resultMatchesMunicipalityHints(result, municipalityNames = []) {
  if (!Array.isArray(municipalityNames) || municipalityNames.length === 0) {
    return false;
  }

  const jurisdiction = normalizeLookupText(result?.jurisdiction);
  const title = normalizeLookupText(result?.title);

  return municipalityNames.some((name) => {
    const normalizedName = normalizeLookupText(name);
    return normalizedName && (jurisdiction.includes(normalizedName) || title.includes(normalizedName));
  });
}

function scoreInspectionTitleMatch(result, detection) {
  const cleanedDetectionTitle = cleanDetectedOrdinanceTitleHint(detection?.ordinanceTitleQuery);
  const normalizedQuery = normalizeLookupText(cleanedDetectionTitle);
  const normalizedTitle = normalizeLookupText(result?.title);
  const municipalityNames = detection?.municipalityHints ?? [];
  const queryTokens = getMeaningfulTitleTokens(cleanedDetectionTitle, municipalityNames);
  const resultTokenSet = new Set(getMeaningfulTitleTokens(result?.title, municipalityNames));
  const overlap = queryTokens.filter((token) => resultTokenSet.has(token)).length;
  let score = 0;

  if (normalizedQuery && normalizedTitle === normalizedQuery) {
    score += 240;
  } else if (
    normalizedQuery &&
    normalizedTitle &&
    (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle))
  ) {
    score += 160;
  }

  if (overlap > 0) {
    score += overlap * 40;
  } else if (queryTokens.length > 0) {
    score -= 160;
  }

  if (queryTokens.length > overlap) {
    score -= (queryTokens.length - overlap) * 8;
  }

  return {
    score,
    overlap,
    queryTokenCount: queryTokens.length
  };
}

function mergeInspectionCandidates(candidateGroups = []) {
  const mergedById = new Map();

  for (const group of candidateGroups) {
    const route = normalizeText(group?.route) || "unknown";
    for (const candidate of Array.isArray(group?.results) ? group.results : []) {
      const candidateId = normalizeText(candidate?.id);
      if (!candidateId) {
        continue;
      }

      const existing = mergedById.get(candidateId);
      mergedById.set(candidateId, {
        ...(existing ?? {}),
        ...candidate,
        _inspectionRoutes: unique([...(existing?._inspectionRoutes ?? []), route])
      });
    }
  }

  return [...mergedById.values()];
}

function rankInspectionCandidates({ candidates = [], detection, recommendation }) {
  const recommendedAfterId = normalizeText(recommendation?.after?.id);

  return candidates
    .map((candidate, index) => {
      const titleMatch = scoreInspectionTitleMatch(candidate, detection);
      const routes = Array.isArray(candidate?._inspectionRoutes) ? candidate._inspectionRoutes : [];
      const municipalityMatch = resultMatchesMunicipalityHints(candidate, detection?.municipalityHints);
      const timestamp = parseInspectionResultTimestamp(candidate);
      let score = titleMatch.score;

      if (municipalityMatch) {
        score += 40;
      }
      if (normalizeText(candidate?.id) === recommendedAfterId) {
        score += 50;
      }
      if (candidate?.current === true) {
        score += 12;
      }
      if (detection?.hasExplicitOrdinanceLine && routes.includes("search")) {
        score += 18;
      }
      if (!detection?.hasExplicitOrdinanceLine && routes.includes("discover")) {
        score += 10;
      }
      if (timestamp > 0) {
        score += 2;
      }

      return {
        candidate,
        index,
        score,
        timestamp,
        overlap: titleMatch.overlap
      };
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.overlap !== right.overlap) {
        return right.overlap - left.overlap;
      }
      if (left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp;
      }
      if (Number(right.candidate?.current === true) !== Number(left.candidate?.current === true)) {
        return Number(right.candidate?.current === true) - Number(left.candidate?.current === true);
      }
      return left.index - right.index;
    })
    .map((entry) => entry.candidate);
}

function stripInspectionCandidateInternalFields(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return candidate;
  }

  const { _inspectionRoutes, ...rest } = candidate;
  return rest;
}

function getSelectedInspectionRoute(candidate, detection) {
  const routes = Array.isArray(candidate?._inspectionRoutes) ? candidate._inspectionRoutes : [];

  if (detection?.hasExplicitOrdinanceLine && routes.includes("search")) {
    return "search";
  }
  if (routes.includes("discover")) {
    return "discover";
  }
  return routes[0] ?? "discover";
}

async function detectApplicableOrdinance({
  documentText,
  requestedMunicipalities,
  env,
  fetchImpl
}) {
  const requestedMunicipalityNames = getMunicipalityNames(requestedMunicipalities);
  const heuristic = buildHeuristicDetectionV2(documentText, requestedMunicipalityNames);
  const aiResult = await requestGeminiJson(
    buildDetectionPrompt(documentText.slice(0, MAX_DOCUMENT_CHARS), requestedMunicipalityNames),
    {
      env,
      fetchImpl,
      temperature: 0.1
    }
  );

  const merged = {
    ...heuristic,
    ...(aiResult.value && typeof aiResult.value === "object" ? aiResult.value : {})
  };

  const municipalityCodes = normalizeMunicipalityCodes([
    ...requestedMunicipalities,
    ...(Array.isArray(merged.municipalityHints) ? merged.municipalityHints : [])
  ]);
  const municipalityNames = getMunicipalityNames(municipalityCodes);
  const preferHeuristicTitle = shouldPreferHeuristicTitle({
    heuristicTitle: heuristic.ordinanceTitleQuery,
    detectedTitle: normalizeText(merged.ordinanceTitleQuery),
    municipalityNames
  }) || heuristic.hasExplicitOrdinanceLine;

  return {
    ordinanceTitleQuery: preferHeuristicTitle
      ? heuristic.ordinanceTitleQuery
      : normalizeText(merged.ordinanceTitleQuery) || heuristic.ordinanceTitleQuery,
    municipalityHints: municipalityNames,
    municipalityCodes,
    keywords: preferHeuristicTitle
      ? heuristic.keywords
      : unique(Array.isArray(merged.keywords) ? merged.keywords.map(normalizeText) : heuristic.keywords).slice(0, 8),
    reasoning: preferHeuristicTitle
      ? `${heuristic.reasoning} 문서에 직접 나타난 조례명과 AI 후보의 핵심어가 겹치지 않아 제목 후보는 규칙 기반 추출값을 우선 사용했습니다.`
      : normalizeText(merged.reasoning) || heuristic.reasoning,
    confidence: normalizeText(merged.confidence) || heuristic.confidence,
    documentType: normalizeText(merged.documentType) || heuristic.documentType,
    ai: aiResult.meta
  };
}

function findLatestMatchedResult(results = [], recommendation) {
  if (recommendation?.after?.id) {
    const recommended = results.find((result) => result.id === recommendation.after.id);
    if (recommended) {
      return recommended;
    }
  }

  return results[0] ?? null;
}

function findBundledOrdinanceFallback({ ordinanceTitleQuery, documentText }) {
  const candidates = [ordinanceTitleQuery, documentText]
    .map((value) => normalizeLookupText(value))
    .filter(Boolean);

  return BUNDLED_ORDINANCE_FALLBACKS.find((entry) =>
    entry.aliases.some((alias) => {
      const normalizedAlias = normalizeLookupText(alias);
      return candidates.some((candidate) => candidate.includes(normalizedAlias));
    })
  ) ?? null;
}

function readBundledOrdinanceFallback(entry) {
  const payload = JSON.parse(fs.readFileSync(entry.filePath, "utf8").replace(/^\uFEFF/, ""));
  return {
    matched: payload.matched,
    candidates: [payload.matched],
    recommendation: null,
    searchMeta: {
      provider: DEFAULT_PROVIDER,
      mode: "bundled-fallback",
      route: "bundled-fallback",
      fallbackId: entry.fallbackId
    },
    document: payload.document,
    documentMeta: {
      provider: DEFAULT_PROVIDER,
      mode: "bundled-fallback",
      id: payload.matched?.id ?? "",
      referenceUrl: payload.matched?.referenceUrl ?? ""
    }
  };
}

async function resolveLatestOrdinance({
  provider,
  detection,
  documentText,
  discoverLawSourceFn,
  searchLawSourceFn,
  readLawSourceDocumentFn,
  recommendLawSourcePairFn
}) {
  const bundledFallback = findBundledOrdinanceFallback({
    ordinanceTitleQuery: detection.ordinanceTitleQuery,
    documentText
  });
  let discovery = { results: [], meta: { route: "discover" } };
  let discoveryError = null;

  try {
    discovery = await discoverLawSourceFn({
      provider,
      query: detection.ordinanceTitleQuery,
      limit: 8,
      municipalities: detection.municipalityCodes
    });
  } catch (error) {
    discoveryError = error;
  }

  let candidates = Array.isArray(discovery.results) ? discovery.results : [];
  let searchMeta = {
    ...discovery.meta,
    route: "discover"
  };

  if (candidates.length === 0) {
    let search = { results: [], meta: { route: "search" } };
    let searchError = null;

    try {
      search = await searchLawSourceFn({
        provider,
        query: detection.ordinanceTitleQuery,
        limit: 8,
        municipalities: detection.municipalityCodes
      });
      candidates = Array.isArray(search.results) ? search.results : [];
      searchMeta = {
        ...search.meta,
        route: "search"
      };
    } catch (error) {
      searchError = error;
    }

    const recommendation = recommendLawSourcePairFn(candidates, detection.ordinanceTitleQuery);
    const matched = findLatestMatchedResult(candidates, recommendation);

    if (!matched) {
      if (bundledFallback) {
        return readBundledOrdinanceFallback(bundledFallback);
      }

      if (searchError || discoveryError) {
        throw searchError ?? discoveryError;
      }

      throw buildInspectionResolutionError("적용 가능한 최신 조례를 찾지 못했습니다.");
    }

    try {
      const documentResult = await readLawSourceDocumentFn({
        provider,
        id: matched.id
      });

      return {
        matched,
        candidates,
        recommendation,
        searchMeta,
        document: documentResult.document,
        documentMeta: documentResult.meta
      };
    } catch (error) {
      if (bundledFallback) {
        return readBundledOrdinanceFallback(bundledFallback);
      }
      throw error;
    }
  }

  const matched = candidates[0];
  try {
    const documentResult = await readLawSourceDocumentFn({
      provider,
      id: matched.id
    });

    return {
      matched,
      candidates,
      recommendation: null,
      searchMeta,
      document: documentResult.document,
      documentMeta: documentResult.meta
    };
  } catch (error) {
    if (bundledFallback) {
      return readBundledOrdinanceFallback(bundledFallback);
    }
    throw error;
  }
}

async function resolveLatestOrdinanceV2({
  provider,
  detection,
  documentText,
  discoverLawSourceFn,
  searchLawSourceFn,
  readLawSourceDocumentFn,
  recommendLawSourcePairFn
}) {
  const bundledFallback = findBundledOrdinanceFallback({
    ordinanceTitleQuery: detection.ordinanceTitleQuery,
    documentText
  });
  let discovery = { results: [], meta: { route: "discover" } };
  let discoveryError = null;
  let search = { results: [], meta: { route: "search" } };
  let searchError = null;

  try {
    discovery = await discoverLawSourceFn({
      provider,
      query: detection.ordinanceTitleQuery,
      limit: 8,
      municipalities: detection.municipalityCodes
    });
  } catch (error) {
    discoveryError = error;
  }

  try {
    search = await searchLawSourceFn({
      provider,
      query: detection.ordinanceTitleQuery,
      limit: 8,
      municipalities: detection.municipalityCodes
    });
  } catch (error) {
    searchError = error;
  }

  const discoveryCandidates = Array.isArray(discovery.results) ? discovery.results : [];
  const searchCandidates = Array.isArray(search.results) ? search.results : [];
  const mergedCandidates = mergeInspectionCandidates([
    {
      route: "search",
      results: searchCandidates
    },
    {
      route: "discover",
      results: discoveryCandidates
    }
  ]);
  const recommendationSeed = searchCandidates.length > 0 ? searchCandidates : mergedCandidates;
  const recommendation = recommendLawSourcePairFn(recommendationSeed, detection.ordinanceTitleQuery);
  const rankedCandidates = rankInspectionCandidates({
    candidates: mergedCandidates,
    detection,
    recommendation
  });
  const matchedCandidate = findLatestMatchedResult(rankedCandidates, recommendation);

  if (!matchedCandidate) {
    if (bundledFallback) {
      return readBundledOrdinanceFallback(bundledFallback);
    }
    if (searchError || discoveryError) {
      throw searchError ?? discoveryError;
    }
    throw buildInspectionResolutionError("적용 가능한 최신 조례를 찾지 못했습니다.");
  }

  const selectedRoute = getSelectedInspectionRoute(matchedCandidate, detection);
  const matched = stripInspectionCandidateInternalFields(matchedCandidate);
  const candidates = rankedCandidates.map((candidate) => stripInspectionCandidateInternalFields(candidate));
  const searchMeta = {
    ...(selectedRoute === "search" ? search.meta : discovery.meta),
    route: selectedRoute,
    selectionMode: "ranked",
    consideredRoutes: unique([
      ...(searchCandidates.length > 0 ? ["search"] : []),
      ...(discoveryCandidates.length > 0 ? ["discover"] : [])
    ])
  };

  try {
    const documentResult = await readLawSourceDocumentFn({
      provider,
      id: matched.id
    });

    return {
      matched,
      candidates,
      recommendation,
      searchMeta,
      document: documentResult.document,
      documentMeta: documentResult.meta
    };
  } catch (error) {
    if (bundledFallback) {
      return readBundledOrdinanceFallback(bundledFallback);
    }
    throw error;
  }
}

async function compareAgainstLatestOrdinance({
  documentText,
  ordinance,
  detection,
  env,
  fetchImpl
}) {
  const fallback = buildHeuristicReviewEnhanced({
    documentText,
    ordinance,
    detection
  });
  const clauseContext = buildClauseContext(documentText, ordinance.document?.clauses ?? []);
  const aiResult = await requestGeminiJson(
    buildComparisonPrompt({
      documentText: documentText.slice(0, MAX_DOCUMENT_CHARS),
      ordinance,
      clauseContext,
      detection
    }),
    {
      env,
      fetchImpl,
      temperature: 0.2
    }
  );

  const payload = aiResult.value && typeof aiResult.value === "object" ? aiResult.value : {};
  const issues = Array.isArray(payload.issues)
    ? payload.issues.map((issue, index) => normalizeIssue(issue, index))
    : fallback.issues;
  const checklist = Array.isArray(payload.checklist)
    ? unique(payload.checklist.map(normalizeText)).filter(Boolean)
    : fallback.checklist;

  return {
    summary: normalizeText(payload.summary) || fallback.summary,
    reasoning: normalizeText(payload.reasoning) || fallback.reasoning,
    riskLevel: normalizeText(payload.riskLevel) || fallback.riskLevel,
    issues,
    checklist,
    revisedDraft: normalizeText(payload.revisedDraft) || fallback.revisedDraft,
    ai: aiResult.meta
  };
}

export async function inspectDocumentAgainstLatestOrdinance(
  {
    documentText,
    fileName = "",
    municipalities = [],
    provider = DEFAULT_PROVIDER
  },
  {
    env = process.env,
    fetchImpl = globalThis.fetch,
    discoverLawSourceFn = discoverLawSource,
    searchLawSourceFn = searchLawSource,
    readLawSourceDocumentFn = readLawSourceDocument,
    recommendLawSourcePairFn = recommendLawSourcePair,
    now = () => new Date().toISOString()
  } = {}
) {
  const normalizedDocumentText = cleanDocumentText(documentText);
  const normalizedMunicipalities = normalizeMunicipalityCodes(municipalities);

  if (!normalizedDocumentText) {
    throw buildInspectionInputError("documentText", "must be a non-empty string");
  }

  const detection = await detectApplicableOrdinance({
    documentText: normalizedDocumentText,
    requestedMunicipalities: normalizedMunicipalities,
    env,
    fetchImpl
  });

  const ordinance = await resolveLatestOrdinanceV2({
    provider,
    detection,
    documentText: normalizedDocumentText,
    discoverLawSourceFn,
    searchLawSourceFn,
    readLawSourceDocumentFn,
    recommendLawSourcePairFn
  });

  const review = await compareAgainstLatestOrdinance({
    documentText: normalizedDocumentText,
    ordinance,
    detection,
    env,
    fetchImpl
  });

  const suggestedFileName = `${sanitizeFileStem(
    fileName || ordinance.matched?.title || detection.ordinanceTitleQuery || "document-review"
  ) || "document-review"}-revision.md`;
  const downloadContent = buildMarkdownDownload({
    fileName,
    ordinance,
    detection: {
      ...detection,
      reasoning: review.reasoning || detection.reasoning
    },
    review
  });

  return {
    meta: {
      generatedAt: now(),
      provider,
      fileName: normalizeText(fileName),
      detectionAi: detection.ai,
      reviewAi: review.ai,
      search: ordinance.searchMeta
    },
    detection: {
      ordinanceTitleQuery: detection.ordinanceTitleQuery,
      municipalityCodes: detection.municipalityCodes,
      municipalityNames: detection.municipalityHints,
      keywords: detection.keywords,
      reasoning: detection.reasoning,
      confidence: detection.confidence,
      documentType: detection.documentType
    },
    ordinance: {
      matched: ordinance.matched,
      recommendation: ordinance.recommendation,
      candidates: ordinance.candidates,
      document: {
        title: ordinance.document?.title,
        version: ordinance.document?.version,
        clauseCount: Array.isArray(ordinance.document?.clauses) ? ordinance.document.clauses.length : 0,
        sampleClauses: (ordinance.document?.clauses ?? []).slice(0, 3).map((clause) => ({
          id: clause.id,
          title: clause.title,
          text: summarizeClause(clause, 180)
        }))
      },
      documentMeta: ordinance.documentMeta
    },
    review: {
      summary: review.summary,
      reasoning: review.reasoning,
      riskLevel: review.riskLevel,
      issues: review.issues,
      checklist: review.checklist,
      revisedDraft: review.revisedDraft
    },
    download: {
      fileName: suggestedFileName,
      contentType: "text/markdown; charset=utf-8",
      content: downloadContent
    }
  };
}
