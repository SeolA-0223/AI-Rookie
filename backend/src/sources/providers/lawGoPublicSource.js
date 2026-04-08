import http from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import { buildSourceStatus, normalizeEnvValue, SourceResolutionError } from "../shared.js";

const DEFAULT_BASE_URL = "https://www.law.go.kr";
const DEFAULT_OC = "test";
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 5;
const DEFAULT_GUBUN = "ELIS";
const DEFAULT_CHR_CLS_CD = "010202";
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

async function requestText(url, init = {}, redirectCount = 0) {
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

async function fetchText(url, init, message, path) {
  try {
    const response = await requestText(url, init);
    return readTextResponse(response, message, path);
  } catch (error) {
    throw buildFetchError(message, [
      {
        path,
        message: error instanceof Error ? error.message : String(error)
      }
    ]);
  }
}

async function searchOfficialOrdinances({ baseUrls, oc, query, limit }) {
  let lastError = null;

  for (const baseUrl of baseUrls) {
    try {
      const searchUrl = buildAbsoluteUrl(baseUrl, "/DRF/lawSearch.do", {
        OC: oc,
        target: "ordin",
        type: "JSON",
        mobileYn: "Y",
        query
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

      return normalizeLawSearchPayload(parsed)
        .map((candidate) => normalizeSearchResult(baseUrl, candidate))
        .filter((candidate) => candidate && candidate.id)
        .slice(0, limit);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? buildFetchError("Failed to search ordinances from law.go.kr.");
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
      const infoUrl = buildReferenceUrl(baseUrl, ordinSeq);
      const infoHtml = await fetchText(
        infoUrl,
        {},
        "Failed to fetch the public ordinance detail page.",
        `source.${label}Id`
      );

      const ancYd = extractInputValue(infoHtml, "ancYd");
      const ancNo = extractInputValue(infoHtml, "ancNo");
      const lgovOrgCd = extractInputValue(infoHtml, "lgovOrgCd");
      const title = extractInputValue(infoHtml, "ordinNm") || extractInnerText(infoHtml, /<h2>([\s\S]*?)<\/h2>/i);

      if (!ancYd || !ancNo) {
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
        gubun: DEFAULT_GUBUN,
        paras: "",
        nwYn: "1",
        ancYd,
        ancNo,
        lgovOrgCd
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
        outPutGubun: DEFAULT_GUBUN,
        gubun: DEFAULT_GUBUN
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
        title: title || extractInnerText(printHtml, /<h2>([\s\S]*?)<\/h2>/i) || ordinSeq,
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

      if (!query) {
        throw buildSourceInputError([{ path: "query", message: "is required" }]);
      }

      const results = await searchOfficialOrdinances({
        baseUrls: baseUrlCandidates,
        oc: resolvedOc,
        query,
        limit
      });

      let resolvedResults = results;
      let historyExpanded = false;

      if (shouldExpandHistory(results, query)) {
        try {
          const historyResults = await fetchHistoryEntries({
            baseUrls: baseUrlCandidates,
            ordinanceId: results[0].id,
            seedResult: results[0]
          });

          if (historyResults.length > 1) {
            resolvedResults = mergeSearchResults(results, historyResults, limit);
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
          ocMode,
          historyExpanded,
          historySeedId: historyExpanded ? results[0].id : null
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
          ocMode
        }
      };
    }
  };
}
