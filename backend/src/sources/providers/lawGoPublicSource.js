import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { buildSourceStatus, normalizeEnvValue, SourceResolutionError } from "../shared.js";
import { listLocalFixtureCases } from "./localFixtureLawSource.js";

const DEFAULT_BASE_URL = "https://www.law.go.kr";
const DEFAULT_OC = "test";
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRY_COUNT = 2;
const MAX_REDIRECTS = 5;
const DEFAULT_GUBUN = "ELIS";
const DEFAULT_CHR_CLS_CD = "010202";
const DEFAULT_DETAIL_GUBUN = "KLAW";
const JURISDICTION_SUFFIXES = [
  "\uD2B9\uBCC4\uC790\uCE58\uB3C4",
  "\uD2B9\uBCC4\uC790\uCE58\uC2DC",
  "\uD2B9\uBCC4\uC2DC",
  "\uAD11\uC5ED\uC2DC",
  "\uC790\uCE58\uB3C4",
  "\uC790\uCE58\uC2DC",
  "\uB3C4",
  "\uC2DC",
  "\uAD70",
  "\uAD6C"
];
const HISTORY_QUERY_STOP_WORDS = new Set([
  "ordinance",
  "ordinances",
  "law",
  "laws",
  "local",
  "the",
  "\uC870\uB840",
  "\uBC95\uADDC",
  "\uBC95"
]);

function buildSourceInputError(details) {
  return new SourceResolutionError({
    code: "SOURCE_INPUT_INVALID",
    message: "Source request is invalid.",
    details,
    statusCode: 400
  });
}

function buildFetchError(message, details = []) {
  return new SourceResolutionError({
    code: "SOURCE_FETCH_FAILED",
    message,
    details,
    statusCode: 502
  });
}

function parseSearchLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 10);
}

function resolveBaseUrl(baseUrl) {
  const normalizedBaseUrl = normalizeEnvValue(baseUrl) || DEFAULT_BASE_URL;

  try {
    return new URL(normalizedBaseUrl);
  } catch {
    return null;
  }
}

function buildBaseUrlCandidates(baseUrl) {
  const primaryBaseUrl = resolveBaseUrl(baseUrl);
  if (!primaryBaseUrl) {
    return [];
  }

  const candidates = [primaryBaseUrl];
  const alternateBaseUrl = new URL(primaryBaseUrl.toString());
  alternateBaseUrl.protocol = primaryBaseUrl.protocol === "https:" ? "http:" : "https:";

  if (alternateBaseUrl.toString() !== primaryBaseUrl.toString()) {
    candidates.push(alternateBaseUrl);
  }

  return candidates;
}

function buildAbsoluteUrl(baseUrl, pathname, searchParams = {}) {
  const url = new URL(pathname, baseUrl);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

function normalizeDateValue(value) {
  const normalizedValue = normalizeEnvValue(value);

  if (/^\d{8}$/.test(normalizedValue)) {
    return `${normalizedValue.slice(0, 4)}-${normalizedValue.slice(4, 6)}-${normalizedValue.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  return normalizedValue;
}

function stripLeadingListIndex(value) {
  return normalizeEnvValue(value)
    .replace(/^\d+\.\s*/, "")
    .replace(/^[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function isJurisdictionToken(token) {
  return JURISDICTION_SUFFIXES.some((suffix) => token.endsWith(suffix));
}

function splitJurisdictionAndBodyTitle(value) {
  const rawValue = normalizeEnvValue(value);

  if (!rawValue) {
    return {
      jurisdiction: "",
      bodyTitle: ""
    };
  }

  const tokens = rawValue.split(/\s+/).filter(Boolean);
  const jurisdictionTokens = [];

  while (tokens.length > 1 && isJurisdictionToken(tokens[0])) {
    jurisdictionTokens.push(tokens.shift());
  }

  return {
    jurisdiction: jurisdictionTokens.join(" ").trim(),
    bodyTitle: tokens.join(" ").trim() || rawValue
  };
}

function normalizeHistoryDateValue(value) {
  const normalizedValue = normalizeEnvValue(value).replace(/\s+/g, " ");
  const match = normalizedValue.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);

  if (!match) {
    return normalizeDateValue(normalizedValue);
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeSearchText(value) {
  return normalizeEnvValue(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/[\s_-]+/g, " ")
    .trim();
}

function tokenizeSearchText(value) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !HISTORY_QUERY_STOP_WORDS.has(token));
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_match, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)));
}

function stripHtml(value) {
  return decodeHtmlEntities(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractInputValue(html, inputId) {
  const pattern = new RegExp(
    `<input[^>]+id=["']${escapeRegExp(inputId)}["'][^>]+value=["']([^"']*)["']`,
    "i"
  );

  const match = html.match(pattern);
  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function extractInnerText(html, pattern) {
  const match = html.match(pattern);
  return match ? stripHtml(match[1]) : "";
}

function normalizeOrdinanceId(value) {
  const normalizedValue = normalizeEnvValue(value);
  if (!normalizedValue) {
    return "";
  }

  if (/^\d+$/.test(normalizedValue)) {
    return normalizedValue;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    const ordinSeq = normalizeEnvValue(parsedUrl.searchParams.get("ordinSeq"));
    const mst = normalizeEnvValue(parsedUrl.searchParams.get("MST"));

    if (/^\d+$/.test(ordinSeq)) {
      return ordinSeq;
    }
    if (/^\d+$/.test(mst)) {
      return mst;
    }
  } catch {
    // Keep the original value for validation below.
  }

  return normalizedValue;
}

function normalizeLawSearchPayload(payload) {
  if (Array.isArray(payload?.OrdinSearch?.law)) {
    return payload.OrdinSearch.law;
  }

  if (payload?.OrdinSearch?.law && typeof payload.OrdinSearch.law === "object") {
    return [payload.OrdinSearch.law];
  }

  if (Array.isArray(payload?.law)) {
    return payload.law;
  }

  return [];
}

function buildReferenceUrl(baseUrl, ordinSeq) {
  return buildAbsoluteUrl(baseUrl, "/LSW/ordinInfoP.do", {
    urlMode: "ordinScJoRltInfoR",
    viewCls: "ordinInfoP",
    ordinSeq,
    chrClsCd: DEFAULT_CHR_CLS_CD,
    gubun: DEFAULT_GUBUN
  }).toString();
}

function buildInfoPageUrl(baseUrl, ordinSeq, { gubun = DEFAULT_DETAIL_GUBUN, chrClsCd = DEFAULT_CHR_CLS_CD, nwYn = "" } = {}) {
  return buildAbsoluteUrl(baseUrl, "/LSW/ordinInfoP.do", {
    ordinSeq,
    chrClsCd,
    gubun,
    nwYn
  });
}

function normalizeSearchResult(baseUrl, candidate) {
  const ordinSeq = normalizeEnvValue(candidate?.자치법규일련번호);
  const title = normalizeEnvValue(candidate?.자치법규명);

  if (!ordinSeq || !title) {
    return null;
  }

  const summaryParts = [
    normalizeEnvValue(candidate?.자치법규종류),
    normalizeEnvValue(candidate?.제개정구분명),
    normalizeEnvValue(candidate?.자치법규분야명)
  ].filter(Boolean);

  return {
    id: ordinSeq,
    title,
    jurisdiction: normalizeEnvValue(candidate?.지자체기관명),
    effectiveDate: normalizeDateValue(candidate?.시행일자),
    promulgationDate: normalizeDateValue(candidate?.공포일자),
    referenceUrl: buildReferenceUrl(baseUrl, ordinSeq),
    summary: summaryParts.join(" / ")
  };
}

function scoreHistorySeed(result, query) {
  const normalizedTitle = normalizeSearchText(result?.title);
  const normalizedJurisdiction = normalizeSearchText(result?.jurisdiction);
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(query);
  let score = 0;

  if (!normalizedTitle || !normalizedQuery) {
    return 0;
  }

  if (normalizedTitle === normalizedQuery) {
    score += 10;
  } else if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    score += 6;
  }

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) {
      score += 2;
    } else if (normalizedJurisdiction.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function shouldExpandHistory(results, query) {
  if (!Array.isArray(results) || results.length === 0) {
    return false;
  }

  if (results.length === 1) {
    return true;
  }

  const topScore = scoreHistorySeed(results[0], query);
  return results.length <= 3 && topScore >= 6;
}

function parseHistoryEntries(historyHtml, baseUrl, seedResult) {
  const itemPattern =
    /<a[^>]+onclick="javascript:ordinViewOrdinHst\('(\d+)','([YN])'\);return false;"[^>]*>([\s\S]*?)<\/a>/gi;
  const historyEntries = [];
  let match;

  while ((match = itemPattern.exec(historyHtml)) !== null) {
    const [, ordinanceId, currentFlag, anchorHtml] = match;
    const lines = stripHtml(anchorHtml)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const title = normalizeEnvValue((lines[0] ?? "").replace(/^\d+\.\s*/, "")) || seedResult.title;
    const versionLine = lines.slice(1).join(" ");
    const effectiveDate = normalizeHistoryDateValue(versionLine.match(/\[\s*\uC2DC\uD589\s*([^\]]+)\]/)?.[1] ?? "");
    const promulgationMatch = versionLine.match(/\[[^,]+,\s*([^,]+),\s*([^\]]+)\]/);
    const promulgationDate = normalizeHistoryDateValue(promulgationMatch?.[1] ?? "");
    const amendmentType = normalizeEnvValue(promulgationMatch?.[2] ?? "");

    historyEntries.push({
      id: ordinanceId,
      title,
      jurisdiction: seedResult.jurisdiction ?? "",
      effectiveDate,
      promulgationDate,
      referenceUrl: buildReferenceUrl(baseUrl, ordinanceId),
      summary: amendmentType ? `History entry / ${amendmentType}` : "History entry",
      current: currentFlag === "Y"
    });
  }

  return historyEntries;
}

function mergeSearchResults(primaryResults, historyResults, limit) {
  const mergedResults = [];
  const seenIds = new Set();

  for (const result of [...historyResults, ...primaryResults]) {
    if (!result?.id || seenIds.has(result.id)) {
      continue;
    }

    seenIds.add(result.id);
    mergedResults.push(result);

    if (mergedResults.length >= limit) {
      break;
    }
  }

  return mergedResults;
}

function parsePublicHtmlSearchResults(searchHtml, baseUrl) {
  const itemPattern =
    /<li id="liBgcolor\d+">\s*<a[^>]+onclick="ordinViewAll\('(\d+)'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\);\s*return false;"[^>]*>([\s\S]*?)<\/a>/gi;
  const results = [];
  let match;

  while ((match = itemPattern.exec(searchHtml)) !== null) {
    const [, ordinanceId, gubun, currentFlag, anchorHtml] = match;
    const titleHtml = anchorHtml.match(/<span[^>]+class="tx"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const metadataHtml = anchorHtml.match(/<span[^>]+class="tx2"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "";
    const title = stripLeadingListIndex(stripHtml(titleHtml));
    const inferredTitleParts = splitJurisdictionAndBodyTitle(title);
    const metadata = stripHtml(metadataHtml);
    const effectiveDate = normalizeHistoryDateValue(metadata.match(/\[\s*\uC2DC\uD589\s*([^\]]+)\]/)?.[1] ?? "");
    const promulgationMatch = metadata.match(/\[[^,]+,\s*([^,]+),\s*([^\]]+)\]/);
    const promulgationDate = normalizeHistoryDateValue(promulgationMatch?.[1] ?? "");
    const amendmentType = normalizeEnvValue(promulgationMatch?.[2] ?? "");

    if (!ordinanceId || !title) {
      continue;
    }

    results.push({
      id: ordinanceId,
      title,
      jurisdiction: inferredTitleParts.jurisdiction,
      effectiveDate,
      promulgationDate,
      referenceUrl: buildReferenceUrl(baseUrl, ordinanceId),
      summary: amendmentType ? `Public search / ${amendmentType}` : "Public search",
      current: currentFlag === "1",
      gubun: normalizeEnvValue(gubun)
    });
  }

  return results;
}

function parseSortableSearchDate(value) {
  const normalizedValue = normalizeDateValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return 0;
  }

  const timestamp = Date.parse(`${normalizedValue}T00:00:00Z`);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildSearchQueryProfile(query) {
  const rawQuery = normalizeEnvValue(query);
  const inferredQueryParts = splitJurisdictionAndBodyTitle(rawQuery);

  return {
    rawQuery,
    normalizedQuery: normalizeSearchText(rawQuery),
    normalizedJurisdiction: normalizeSearchText(inferredQueryParts.jurisdiction),
    normalizedBodyTitle: normalizeSearchText(inferredQueryParts.bodyTitle),
    queryTokens: tokenizeSearchText(rawQuery),
    jurisdictionTokens: tokenizeSearchText(inferredQueryParts.jurisdiction)
  };
}

function inferDocumentKind(value) {
  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) {
    return "";
  }
  if (normalizedValue.includes("시행규칙") || normalizedValue.includes("규칙")) {
    return "rule";
  }
  if (normalizedValue.includes("조례")) {
    return "ordinance";
  }

  return "";
}

function countExtraJurisdictionTokens(queryProfile, rawJurisdiction) {
  if (!queryProfile.normalizedJurisdiction) {
    return 0;
  }

  return tokenizeSearchText(rawJurisdiction).filter(
    (token) => !queryProfile.jurisdictionTokens.includes(token)
  ).length;
}

function scoreSearchCandidate(result, queryProfile) {
  const rawTitle = normalizeEnvValue(result?.title);
  const inferredTitleParts = splitJurisdictionAndBodyTitle(rawTitle);
  const rawJurisdiction = normalizeEnvValue(result?.jurisdiction) || inferredTitleParts.jurisdiction;
  const rawBodyTitle =
    rawJurisdiction && rawTitle.startsWith(rawJurisdiction)
      ? normalizeEnvValue(rawTitle.slice(rawJurisdiction.length))
      : inferredTitleParts.bodyTitle;
  const normalizedTitle = normalizeSearchText(rawTitle);
  const normalizedJurisdiction = normalizeSearchText(rawJurisdiction);
  const normalizedBodyTitle = normalizeSearchText(rawBodyTitle);
  const queryDocumentKind = inferDocumentKind(queryProfile.rawQuery);
  const resultDocumentKind = inferDocumentKind(`${rawTitle} ${normalizeEnvValue(result?.summary)}`);
  let score = 0;

  if (!normalizedTitle || !queryProfile.normalizedQuery) {
    return score;
  }

  if (normalizedTitle === queryProfile.normalizedQuery) {
    score += 30;
  } else if (
    normalizedTitle.includes(queryProfile.normalizedQuery) ||
    queryProfile.normalizedQuery.includes(normalizedTitle)
  ) {
    score += 14;
  }

  if (queryProfile.normalizedBodyTitle) {
    if (normalizedBodyTitle === queryProfile.normalizedBodyTitle) {
      score += 8;
    } else if (
      normalizedBodyTitle.includes(queryProfile.normalizedBodyTitle) ||
      queryProfile.normalizedBodyTitle.includes(normalizedBodyTitle)
    ) {
      score += 4;
    }
  }

  for (const token of queryProfile.queryTokens) {
    if (normalizedTitle.includes(token)) {
      score += 2;
    } else if (normalizedJurisdiction.includes(token)) {
      score += 1;
    }
  }

  if (queryProfile.normalizedJurisdiction) {
    if (normalizedJurisdiction === queryProfile.normalizedJurisdiction) {
      score += 8;
    } else if (normalizedJurisdiction.startsWith(queryProfile.normalizedJurisdiction)) {
      score += 1;
      score -= countExtraJurisdictionTokens(queryProfile, rawJurisdiction) * 4;
    } else if (queryProfile.normalizedJurisdiction.startsWith(normalizedJurisdiction)) {
      score -= 1;
    } else {
      score -= 4;
    }
  }

  if (queryDocumentKind && resultDocumentKind && queryDocumentKind !== resultDocumentKind) {
    score -= 6;
  }

  if (result?.current === true) {
    score += 0.5;
  }

  return score;
}

function mergeCandidateResult(existingResult, nextResult) {
  return {
    ...existingResult,
    ...nextResult,
    title: normalizeEnvValue(existingResult?.title) || normalizeEnvValue(nextResult?.title),
    jurisdiction: normalizeEnvValue(existingResult?.jurisdiction) || normalizeEnvValue(nextResult?.jurisdiction),
    effectiveDate: normalizeEnvValue(existingResult?.effectiveDate) || normalizeEnvValue(nextResult?.effectiveDate),
    promulgationDate: normalizeEnvValue(existingResult?.promulgationDate) || normalizeEnvValue(nextResult?.promulgationDate),
    referenceUrl: normalizeEnvValue(existingResult?.referenceUrl) || normalizeEnvValue(nextResult?.referenceUrl),
    summary: normalizeEnvValue(existingResult?.summary) || normalizeEnvValue(nextResult?.summary),
    current: existingResult?.current === true || nextResult?.current === true,
    gubun: normalizeEnvValue(existingResult?.gubun) || normalizeEnvValue(nextResult?.gubun)
  };
}

function rankSearchResults(resultGroups, query, limit) {
  const mergedResults = new Map();
  const queryProfile = buildSearchQueryProfile(query);

  for (const resultGroup of resultGroups) {
    for (const result of resultGroup) {
      if (!result?.id) {
        continue;
      }

      const existingResult = mergedResults.get(result.id);
      mergedResults.set(result.id, existingResult ? mergeCandidateResult(existingResult, result) : result);
    }
  }

  return [...mergedResults.values()]
    .map((result) => ({
      result,
      score: scoreSearchCandidate(result, queryProfile),
      timeline: parseSortableSearchDate(result.effectiveDate) || parseSortableSearchDate(result.promulgationDate)
    }))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (Number(right.result.current === true) !== Number(left.result.current === true)) {
        return Number(right.result.current === true) - Number(left.result.current === true);
      }

      if (left.timeline !== right.timeline) {
        return right.timeline - left.timeline;
      }

      if ((left.result.title ?? "").length !== (right.result.title ?? "").length) {
        return (left.result.title ?? "").length - (right.result.title ?? "").length;
      }

      return String(left.result.id).localeCompare(String(right.result.id));
    })
    .slice(0, limit)
    .map((entry) => entry.result);
}

function buildQueryVariants(query) {
  const rawQuery = normalizeEnvValue(query);
  const inferredQueryParts = splitJurisdictionAndBodyTitle(rawQuery);
  const variants = new Set([rawQuery]);
  const withoutWideRegionSuffix = rawQuery
    .replace(/\uD2B9\uBCC4\uC790\uCE58\uB3C4/g, "")
    .replace(/\uD2B9\uBCC4\uC790\uCE58\uC2DC/g, "")
    .replace(/\uD2B9\uBCC4\uC2DC/g, "")
    .replace(/\uAD11\uC5ED\uC2DC/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutWideRegionSuffix) {
    variants.add(withoutWideRegionSuffix);
  }

  if (inferredQueryParts.bodyTitle && inferredQueryParts.bodyTitle !== rawQuery) {
    variants.add(inferredQueryParts.bodyTitle);
  }

  return [...variants].filter(Boolean).slice(0, 5);
}

function buildCuratedFallbackResults(query, baseUrl) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return [];
  }

  return listLocalFixtureCases()
    .map((entry) => {
      const aliases = [
        entry.officialKoreanTitle,
        entry.title,
        ...(Array.isArray(entry.searchAliases) ? entry.searchAliases : [])
      ]
        .map((value) => normalizeEnvValue(value))
        .filter(Boolean);

      const hasExactAlias = aliases.some((alias) => normalizeSearchText(alias) === normalizedQuery);
      if (!hasExactAlias) {
        return null;
      }

      const ordinanceId = normalizeOrdinanceId(entry.officialUrl);
      if (!ordinanceId) {
        return null;
      }

      const koreanTitle = normalizeEnvValue(entry.officialKoreanTitle) || normalizeEnvValue(entry.title);
      const inferredTitleParts = splitJurisdictionAndBodyTitle(koreanTitle);

      return {
        id: ordinanceId,
        title: koreanTitle,
        jurisdiction: inferredTitleParts.jurisdiction,
        effectiveDate: normalizeDateValue(entry.effectiveDate),
        promulgationDate: normalizeDateValue(entry.effectiveDate),
        referenceUrl: normalizeEnvValue(entry.officialUrl) || buildReferenceUrl(baseUrl, ordinanceId),
        summary: `Curated case-pack fallback / ${normalizeEnvValue(entry.caseId)}`,
        current: false,
        curatedCaseId: normalizeEnvValue(entry.caseId)
      };
    })
    .filter(Boolean);
}

function buildSearchDiagnostics({
  query,
  queryVariants,
  results,
  drfResults,
  htmlResults,
  curatedResults,
  historyExpanded
}) {
  const queryProfile = buildSearchQueryProfile(query);
  const exactTitleMatchCount = results.filter((result) => normalizeSearchText(result.title) === queryProfile.normalizedQuery).length;
  const exactJurisdictionMatchCount = queryProfile.normalizedJurisdiction
    ? results.filter((result) => normalizeSearchText(result.jurisdiction) === queryProfile.normalizedJurisdiction).length
    : 0;

  return {
    queryVariants,
    drfResultCount: drfResults.length,
    htmlResultCount: htmlResults.length,
    curatedResultCount: curatedResults.length,
    exactTitleMatchCount,
    exactJurisdictionMatchCount,
    curatedFallbackUsed: curatedResults.length > 0,
    curatedFallbackCaseIds: curatedResults
      .map((result) => normalizeEnvValue(result.curatedCaseId))
      .filter(Boolean),
    historyExpanded
  };
}

function parseClauseList(text) {
  let parsed;

  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (error) {
    throw buildFetchError("Failed to parse the public ordinance clause list.", [
      {
        path: "response.clauseList",
        message: error instanceof Error ? error.message : String(error)
      }
    ]);
  }

  if (!Array.isArray(parsed)) {
    throw buildFetchError("The public ordinance clause list did not return an array.");
  }

  return parsed
    .map((item) => {
      const joNo = normalizeEnvValue(item?.joNo);
      const oriJoNo = normalizeEnvValue(item?.oriJoNo);
      const joBrNo = normalizeEnvValue(item?.joBrNo) || "00";
      const rawTitle = normalizeEnvValue(item?.joTit).replace(/<[^>]+>/g, "").trim();

      if (!joNo || !oriJoNo || item?.joYn !== "Y") {
        return null;
      }

      return {
        id: `${oriJoNo}:${joBrNo}`,
        joNo,
        title: rawTitle || joNo
      };
    })
    .filter(Boolean);
}

function parseInfoPageMetadata(infoHtml, fallback = {}) {
  return {
    ordinSeq: extractInputValue(infoHtml, "ordinSeq") || normalizeEnvValue(fallback.ordinSeq),
    ordinId: extractInputValue(infoHtml, "ordinId") || normalizeEnvValue(fallback.ordinId),
    ancYd: extractInputValue(infoHtml, "ancYd") || normalizeEnvValue(fallback.ancYd),
    ancNo: extractInputValue(infoHtml, "ancNo") || normalizeEnvValue(fallback.ancNo),
    lgovOrgCd: extractInputValue(infoHtml, "lgovOrgCd") || normalizeEnvValue(fallback.lgovOrgCd),
    gubun: extractInputValue(infoHtml, "gubun") || normalizeEnvValue(fallback.gubun) || DEFAULT_DETAIL_GUBUN,
    nwYn: extractInputValue(infoHtml, "nwYn") || normalizeEnvValue(fallback.nwYn) || "N",
    chrClsCd: extractInputValue(infoHtml, "chrClsCd") || normalizeEnvValue(fallback.chrClsCd) || DEFAULT_CHR_CLS_CD,
    title: extractInputValue(infoHtml, "ordinNm") || extractInnerText(infoHtml, /<h2>([\s\S]*?)<\/h2>/i)
  };
}

function normalizeTransportErrorMessage(error) {
  const topLevelMessage = error instanceof Error ? error.message : String(error);
  const nestedCauseMessage =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error && error.cause
        ? String(error.cause)
        : "";

  return [topLevelMessage, nestedCauseMessage].filter(Boolean).join(" / ");
}

function isRetryableTransportError(error) {
  const message = normalizeTransportErrorMessage(error).toLowerCase();

  return [
    "econnreset",
    "socket hang up",
    "fetch failed",
    "etimedout",
    "request timed out",
    "eai_again",
    "econnrefused",
    "terminated",
    "other side closed"
  ].some((fragment) => message.includes(fragment));
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parsePrintClauses(printHtml, clauseEntries) {
  const labelPattern = /<label\s+for=["']([^"']+)["'][^>]*>([\s\S]*?)<\/label>/gi;
  const labels = [];
  let match;

  while ((match = labelPattern.exec(printHtml)) !== null) {
    labels.push({
      joNo: match[1],
      title: stripHtml(match[2]),
      start: match.index,
      end: labelPattern.lastIndex
    });
  }

  const labelsByJoNo = new Map(labels.map((item) => [item.joNo, item]));
  const clauses = [];

  for (const entry of clauseEntries) {
    const label = labelsByJoNo.get(entry.joNo);
    if (!label) {
      continue;
    }

    const labelIndex = labels.findIndex((candidate) => candidate.joNo === entry.joNo);
    const nextLabel = labelIndex >= 0 ? labels[labelIndex + 1] : null;
    const rawSection = printHtml.slice(label.start, nextLabel ? nextLabel.start : printHtml.length);
    const text = stripHtml(rawSection).replace(new RegExp(`^${escapeRegExp(label.title)}\\s*`), "").trim();

    clauses.push({
      id: entry.id,
      title: label.title || entry.title,
      text: text || label.title || entry.title
    });
  }

  if (!clauses.length) {
    throw buildFetchError("The public ordinance print view did not contain any usable clauses.");
  }

  return clauses;
}

async function readTextResponse(response, message, path) {
  const text = response.body;

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw buildFetchError(message, [
      {
        path,
        message: `${response.statusCode} ${response.statusMessage}`.trim()
      }
    ]);
  }

  return text.replace(/^\uFEFF/, "");
}

function decompressResponseBody(buffer, encoding) {
  if (!encoding) {
    return buffer;
  }

  const normalizedEncoding = encoding.toLowerCase();

  if (normalizedEncoding.includes("gzip")) {
    return zlib.gunzipSync(buffer);
  }
  if (normalizedEncoding.includes("deflate")) {
    return zlib.inflateSync(buffer);
  }
  if (normalizedEncoding.includes("br")) {
    return zlib.brotliDecompressSync(buffer);
  }

  return buffer;
}

async function requestTextWithNodeClient(url, init = {}, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error("too many redirects");
  }

  const targetUrl = typeof url === "string" ? new URL(url) : url;
  const requestClient = targetUrl.protocol === "https:" ? https : http;
  const body =
    typeof init.body === "string"
      ? Buffer.from(init.body, "utf8")
      : Buffer.isBuffer(init.body)
        ? init.body
        : null;

  const headers = {
    "user-agent": "AI-Rookie/0.1",
    accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "accept-encoding": "gzip, deflate, br",
    connection: "close",
    ...init.headers
  };

  if (body && !headers["content-length"] && !headers["Content-Length"]) {
    headers["content-length"] = String(body.length);
  }

  return new Promise((resolve, reject) => {
    const request = requestClient.request(targetUrl, {
      method: init.method ?? "GET",
      headers
    }, (response) => {
      const chunks = [];

      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("error", reject);
      response.on("end", async () => {
        try {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            const redirectUrl = new URL(response.headers.location, targetUrl);
            resolve(await requestText(redirectUrl, init, redirectCount + 1));
            return;
          }

          const rawBuffer = Buffer.concat(chunks);
          const decodedBuffer = decompressResponseBody(rawBuffer, response.headers["content-encoding"]);

          resolve({
            statusCode: response.statusCode ?? 0,
            statusMessage: response.statusMessage ?? "",
            body: decodedBuffer.toString("utf8")
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.setTimeout(DEFAULT_TIMEOUT_MS, () => {
      request.destroy(new Error("request timed out"));
    });
    request.on("error", reject);

    if (body) {
      request.write(body);
    }
    request.end();
  });
}

async function requestText(url, init = {}, redirectCount = 0) {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error("too many redirects");
  }

  const targetUrl = typeof url === "string" ? new URL(url) : url;
  const body =
    typeof init.body === "string"
      ? init.body
      : Buffer.isBuffer(init.body)
        ? init.body
        : null;
  const headers = {
    "user-agent": "AI-Rookie/0.1",
    accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "accept-encoding": "gzip, deflate, br",
    connection: "close",
    referer: buildAbsoluteUrl(targetUrl, "/").toString(),
    ...init.headers
  };

  if (typeof fetch === "function") {
    try {
      const response = await fetch(targetUrl, {
        method: init.method ?? "GET",
        headers,
        body,
        redirect: "manual"
      });

      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        const redirectUrl = new URL(response.headers.get("location"), targetUrl);
        return requestText(redirectUrl, init, redirectCount + 1);
      }

      return {
        statusCode: response.status,
        statusMessage: response.statusText ?? "",
        body: await response.text()
      };
    } catch {
      // Fall back to the lower-level client for hosts that behave better there.
    }
  }

  return requestTextWithNodeClient(targetUrl, { ...init, headers }, redirectCount);
}

async function fetchText(url, init, message, path) {
  let lastError = null;

  for (let attempt = 0; attempt <= DEFAULT_RETRY_COUNT; attempt += 1) {
    try {
      const response = await requestText(url, init);
      return readTextResponse(response, message, path);
    } catch (error) {
      lastError = error;

      if (attempt >= DEFAULT_RETRY_COUNT || !isRetryableTransportError(error)) {
        break;
      }

      await delay(250 * (attempt + 1));
    }
  }

  throw buildFetchError(message, [
    {
      path,
      message: normalizeTransportErrorMessage(lastError)
    }
  ]);
}

async function searchOfficialOrdinances({ baseUrls, oc, query, limit, queryVariants = buildQueryVariants(query) }) {
  let lastError = null;

  for (const baseUrl of baseUrls) {
    let sawResponse = false;
    const collectedResults = [];

    for (const queryVariant of queryVariants) {
      try {
        const searchUrl = buildAbsoluteUrl(baseUrl, "/DRF/lawSearch.do", {
          OC: oc,
          target: "ordin",
          type: "JSON",
          mobileYn: "Y",
          query: queryVariant
        });

        const searchText = await fetchText(
          searchUrl,
          {},
          "Failed to search ordinances from law.go.kr.",
          "query"
        );

        let parsed;

        try {
          parsed = JSON.parse(searchText);
        } catch (error) {
          throw buildFetchError("law.go.kr search returned invalid JSON.", [
            {
              path: "response.search",
              message: error instanceof Error ? error.message : String(error)
            }
          ]);
        }

        sawResponse = true;
        collectedResults.push(
          ...normalizeLawSearchPayload(parsed)
            .map((candidate) => normalizeSearchResult(baseUrl, candidate))
            .filter((candidate) => candidate && candidate.id)
        );
      } catch (error) {
        lastError = error;
      }
    }

    if (collectedResults.length > 0) {
      return rankSearchResults([collectedResults], query, limit);
    }

    if (sawResponse) {
      return [];
    }
  }

  throw lastError ?? buildFetchError("Failed to search ordinances from law.go.kr.");
}

async function searchPublicHtmlOrdinances({ baseUrls, query, limit, queryVariants = buildQueryVariants(query) }) {
  let lastError = null;

  for (const baseUrl of baseUrls) {
    let sawResponse = false;
    const collectedResults = [];

    for (const queryVariant of queryVariants) {
      try {
        const searchUrl = buildAbsoluteUrl(baseUrl, "/LSW/ordinScListR.do", {
          menuId: "3",
          subMenuId: "27",
          tabMenuId: "139",
          q: queryVariant,
          section: "ordinNm",
          outmax: String(Math.max(limit, 10)),
          pg: "1",
          dtlYn: "N"
        });

        const searchHtml = await fetchText(
          searchUrl,
          {},
          "Failed to search ordinances from the public law.go.kr HTML endpoint.",
          "query"
        );

        sawResponse = true;
        collectedResults.push(...parsePublicHtmlSearchResults(searchHtml, baseUrl));
      } catch (error) {
        lastError = error;
      }
    }

    const results = rankSearchResults([collectedResults], query, limit);

    if (results.length > 0) {
      return results;
    }

    if (sawResponse) {
      return [];
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function fetchHistoryEntries({ baseUrls, ordinanceId, seedResult }) {
  let lastError = null;

  for (const baseUrl of baseUrls) {
    try {
      const historyUrl = buildAbsoluteUrl(baseUrl, "/LSW/ordinHstListR.do", {
        ordinSeq: ordinanceId
      });
      const historyHtml = await fetchText(
        historyUrl,
        {},
        "Failed to fetch the ordinance history list from law.go.kr.",
        "query"
      );
      const historyEntries = parseHistoryEntries(historyHtml, baseUrl, seedResult);

      if (historyEntries.length > 0) {
        return historyEntries;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return [];
}

async function fetchRegulationDocument({ baseUrls, ordinanceId, label }) {
  const ordinSeq = normalizeOrdinanceId(ordinanceId);

  if (!/^\d+$/.test(ordinSeq)) {
    throw buildSourceInputError([
      {
        path: `source.${label}Id`,
        message: "must be a numeric ordinance sequence or a supported law.go.kr URL"
      }
    ]);
  }

  let lastError = null;

  for (const baseUrl of baseUrls) {
    try {
      const infoUrl = buildInfoPageUrl(baseUrl, ordinSeq);
      const infoHtml = await fetchText(
        infoUrl,
        {},
        "Failed to fetch the public ordinance detail page.",
        `source.${label}Id`
      );
      const infoPageMetadata = parseInfoPageMetadata(infoHtml, {
        ordinSeq,
        gubun: DEFAULT_DETAIL_GUBUN
      });

      if (!infoPageMetadata.ancYd || !infoPageMetadata.ancNo) {
        throw buildFetchError("Failed to parse the public ordinance metadata page.", [
          {
            path: "response.infoPage",
            message: "required ordinance metadata fields were missing"
          }
        ]);
      }

      const clauseListUrl = buildAbsoluteUrl(baseUrl, "/LSW/ordinJoListRInc_XML.do", {
        ordinSeq,
        mode: "99",
        chapNo: "1",
        gubun: infoPageMetadata.gubun,
        paras: "",
        nwYn: infoPageMetadata.nwYn,
        ancYd: infoPageMetadata.ancYd,
        ancNo: infoPageMetadata.ancNo,
        lgovOrgCd: infoPageMetadata.lgovOrgCd
      });

      const clauseListText = await fetchText(
        clauseListUrl,
        {},
        "Failed to fetch the public ordinance clause list.",
        `source.${label}Id`
      );
      const clauseEntries = parseClauseList(clauseListText);

      if (!clauseEntries.length) {
        throw buildFetchError("The public ordinance clause list did not contain any selectable clauses.", [
          {
            path: "response.clauseList",
            message: "no usable clause entries were returned"
          }
        ]);
      }

      const printBody = new URLSearchParams({
        ordinSeq,
        outPutGubun: infoPageMetadata.gubun,
        gubun: infoPageMetadata.gubun
      });

      clauseEntries.forEach((entry) => {
        printBody.append("joNo", entry.id);
      });

      const printHtml = await fetchText(
        buildAbsoluteUrl(baseUrl, "/LSW/ordinBdyPrint.do"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: printBody.toString()
        },
        "Failed to fetch the public ordinance print view.",
        `source.${label}Id`
      );

      const version = extractInnerText(printHtml, /<div[^>]+class=["']subtit1["'][^>]*>([\s\S]*?)<\/div>/i);
      const clauses = parsePrintClauses(printHtml, clauseEntries);

      if (clauseEntries.length > 1 && clauses.length === 1) {
        throw buildFetchError("The public ordinance print view returned incomplete clause content.", [
          {
            path: "response.printView",
            message: "only one clause was parsed from a multi-clause ordinance"
          }
        ]);
      }

      return {
        title: infoPageMetadata.title || extractInnerText(printHtml, /<h2>([\s\S]*?)<\/h2>/i) || ordinSeq,
        version: version || ordinSeq,
        clauses
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? buildFetchError("Failed to fetch the public ordinance detail page.");
}

export function createLawGoPublicSource({
  baseUrl = process.env.LAW_GO_BASE_URL,
  oc = process.env.LAW_GO_OC
} = {}) {
  const baseUrlCandidates = buildBaseUrlCandidates(baseUrl);
  const resolvedBaseUrl = baseUrlCandidates[0] ?? null;
  const resolvedOc = normalizeEnvValue(oc) || DEFAULT_OC;
  const ocMode = normalizeEnvValue(oc) ? "env" : "test-demo";

  if (!resolvedBaseUrl) {
    return {
      getSourceStatus() {
        return buildSourceStatus({
          provider: "law-go-public",
          enabled: false,
          mode: "adapter",
          missingEnv: [],
          transport: "official-http",
          baseUrl: normalizeEnvValue(baseUrl),
          ocMode
        });
      },
      async resolveRegulationPair() {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_MISCONFIGURED",
          message: "LAW_GO_BASE_URL must be a valid URL.",
          details: [
            {
              path: "env.LAW_GO_BASE_URL",
              message: "must be a valid URL"
            }
          ]
        });
      },
      async searchRegulations() {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_MISCONFIGURED",
          message: "LAW_GO_BASE_URL must be a valid URL.",
          details: [
            {
              path: "env.LAW_GO_BASE_URL",
              message: "must be a valid URL"
            }
          ]
        });
      }
    };
  }

  const status = buildSourceStatus({
    provider: "law-go-public",
    enabled: true,
    mode: "adapter",
    transport: "official-http",
    baseUrl: resolvedBaseUrl.toString().replace(/\/$/, ""),
    ocMode,
    searchTarget: "ordin"
  });

  return {
    getSourceStatus() {
      return status;
    },
    async searchRegulations(input = {}) {
      const query = normalizeEnvValue(input.query);
      const limit = parseSearchLimit(input.limit);
      const queryVariants = buildQueryVariants(query);

      if (!query) {
        throw buildSourceInputError([{ path: "query", message: "is required" }]);
      }

      let drfResults = [];
      let htmlResults = [];
      let drfError = null;
      let htmlError = null;

      try {
        drfResults = await searchOfficialOrdinances({
          baseUrls: baseUrlCandidates,
          oc: resolvedOc,
          query,
          limit,
          queryVariants
        });
      } catch (error) {
        drfError = error;
        if (ocMode === "env") {
          throw error;
        }
      }

      if (ocMode === "test-demo" || drfResults.length < limit) {
        try {
          htmlResults = await searchPublicHtmlOrdinances({
            baseUrls: baseUrlCandidates,
            query,
            limit,
            queryVariants
          });
        } catch (error) {
          htmlError = error;
        }
      }

      if (drfResults.length === 0 && htmlResults.length === 0) {
        throw htmlError ?? drfError ?? buildFetchError("Failed to search ordinances from law.go.kr.");
      }

      let searchBackend = "drf";
      if (drfResults.length > 0 && htmlResults.length > 0) {
        searchBackend = "drf+html";
      } else if (htmlResults.length > 0) {
        searchBackend = "html-fallback";
      }

      const initialResults = rankSearchResults([drfResults, htmlResults], query, limit);
      const initialDiagnostics = buildSearchDiagnostics({
        query,
        queryVariants,
        results: initialResults,
        drfResults,
        htmlResults,
        curatedResults: [],
        historyExpanded: false
      });
      const curatedResults = initialDiagnostics.exactTitleMatchCount === 0
        ? buildCuratedFallbackResults(query, resolvedBaseUrl)
        : [];
      const results = rankSearchResults([curatedResults, drfResults, htmlResults], query, limit);
      let resolvedResults = results;
      let historyExpanded = false;
      const historySeed = results[0] ?? null;

      if (historySeed && shouldExpandHistory(results, query)) {
        try {
          const historyResults = await fetchHistoryEntries({
            baseUrls: baseUrlCandidates,
            ordinanceId: historySeed.id,
            seedResult: historySeed
          });

          if (historyResults.length > 1) {
            resolvedResults = rankSearchResults([results, historyResults], query, limit);
            historyExpanded = true;
          }
        } catch {
          historyExpanded = false;
        }
      }

      return {
        results: resolvedResults,
        meta: {
          provider: "law-go-public",
          mode: "adapter",
          baseUrl: resolvedBaseUrl.toString().replace(/\/$/, ""),
          ocMode,
          searchBackend,
          historyExpanded,
          historySeedId: historyExpanded ? historySeed.id : null,
          diagnostics: buildSearchDiagnostics({
            query,
            queryVariants,
            results: resolvedResults,
            drfResults,
            htmlResults,
            curatedResults,
            historyExpanded
          })
        }
      };
    },
    async resolveRegulationPair(input = {}) {
      const beforeId = normalizeOrdinanceId(input.beforeId);
      const afterId = normalizeOrdinanceId(input.afterId);
      const details = [];

      if (!beforeId) {
        details.push({ path: "source.beforeId", message: "is required" });
      }
      if (!afterId) {
        details.push({ path: "source.afterId", message: "is required" });
      }

      if (details.length > 0) {
        throw buildSourceInputError(details);
      }

      const beforeDoc = await fetchRegulationDocument({
        baseUrls: baseUrlCandidates,
        ordinanceId: beforeId,
        label: "before"
      });
      const afterDoc = await fetchRegulationDocument({
        baseUrls: baseUrlCandidates,
        ordinanceId: afterId,
        label: "after"
      });

      return {
        beforeDoc,
        afterDoc,
        meta: {
          provider: "law-go-public",
          mode: "adapter",
          beforeId,
          afterId,
          ocMode,
          baseUrl: resolvedBaseUrl.toString().replace(/\/$/, ""),
          beforeReferenceUrl: buildReferenceUrl(resolvedBaseUrl, beforeId),
          afterReferenceUrl: buildReferenceUrl(resolvedBaseUrl, afterId)
        }
      };
    }
  };
}
