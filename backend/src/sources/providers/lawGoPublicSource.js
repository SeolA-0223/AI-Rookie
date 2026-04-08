import { buildSourceStatus, normalizeEnvValue, SourceResolutionError } from "../shared.js";

const DEFAULT_BASE_URL = "https://www.law.go.kr";
const DEFAULT_OC = "test";
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_GUBUN = "ELIS";
const DEFAULT_CHR_CLS_CD = "010202";

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
  const text = await response.text();

  if (!response.ok) {
    throw buildFetchError(message, [
      {
        path,
        message: `${response.status} ${response.statusText}`.trim()
      }
    ]);
  }

  return text.replace(/^\uFEFF/, "");
}

async function fetchText(url, init, message, path) {
  let response;

  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    });
  } catch (error) {
    throw buildFetchError(message, [
      {
        path,
        message: error instanceof Error ? error.message : String(error)
      }
    ]);
  }

  return readTextResponse(response, message, path);
}

async function searchOfficialOrdinances({ baseUrl, oc, query, limit }) {
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
}

async function fetchRegulationDocument({ baseUrl, ordinanceId }) {
  const ordinSeq = normalizeOrdinanceId(ordinanceId);

  if (!/^\d+$/.test(ordinSeq)) {
    throw buildSourceInputError([
      {
        path: "source.beforeId",
        message: "must be a numeric ordinance sequence or a supported law.go.kr URL"
      }
    ]);
  }

  const infoUrl = buildReferenceUrl(baseUrl, ordinSeq);
  const infoHtml = await fetchText(
    infoUrl,
    {},
    "Failed to fetch the public ordinance detail page.",
    "source.beforeId"
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
    "source.beforeId"
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
    "source.beforeId"
  );

  const version = extractInnerText(printHtml, /<div[^>]+class=["']subtit1["'][^>]*>([\s\S]*?)<\/div>/i);
  const clauses = parsePrintClauses(printHtml, clauseEntries);

  return {
    title: title || extractInnerText(printHtml, /<h2>([\s\S]*?)<\/h2>/i) || ordinSeq,
    version: version || ordinSeq,
    clauses
  };
}

export function createLawGoPublicSource({
  baseUrl = process.env.LAW_GO_BASE_URL,
  oc = process.env.LAW_GO_OC
} = {}) {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);
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
        baseUrl: resolvedBaseUrl,
        oc: resolvedOc,
        query,
        limit
      });

      return {
        results,
        meta: {
          provider: "law-go-public",
          mode: "adapter",
          ocMode
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
        baseUrl: resolvedBaseUrl,
        ordinanceId: beforeId
      });
      const afterDoc = await fetchRegulationDocument({
        baseUrl: resolvedBaseUrl,
        ordinanceId: afterId
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
