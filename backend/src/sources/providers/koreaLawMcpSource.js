import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  buildSourceStatus,
  normalizeEnvValue,
  SourceResolutionError
} from "../shared.js";

const REQUIRED_ENV = ["KOREA_LAW_MCP_BASE_URL"];
const DEFAULT_DETAIL_TOOL_NAMES = ["get_local_ordinance_detail", "get_ordinance_detail"];
const DEFAULT_SEARCH_TOOL_NAMES = ["search_local_ordinance"];
const DEFAULT_ID_ARGUMENT_NAME = "ID";
const DEFAULT_SEARCH_QUERY_ARGUMENT_NAME = "query";
const CLAUSE_LIST_KEYS = ["clauses", "articles", "articleList", "items", "rows", "조문", "조문목록", "joMunList"];
const DOCUMENT_TITLE_KEYS = ["title", "name", "documentTitle", "ordinanceName", "lawName", "자치법규명", "법령명"];
const DOCUMENT_VERSION_KEYS = ["version", "revision", "effectiveDate", "시행일", "공포일", "date"];
const CLAUSE_ID_KEYS = ["id", "ID", "articleId", "articleNo", "clauseId", "joNo", "조문번호", "번호"];
const CLAUSE_TITLE_KEYS = ["title", "name", "articleTitle", "clauseTitle", "heading", "제목", "조문제목"];
const CLAUSE_TEXT_KEYS = ["text", "content", "articleText", "clauseText", "body", "본문", "내용", "조문내용"];
const TEXT_CONTENT_KEYS = [...CLAUSE_TEXT_KEYS, "fullText", "documentText", "rawText", "전문"];
const SEARCH_RESULT_LIST_KEYS = ["results", "items", "rows", "list", "laws", "ordinances", "data", "searchResults"];
const SEARCH_RESULT_ID_KEYS = ["id", "ID", "ordinanceId", "localOrdinanceId", "lawId", "자치법규ID", "법령ID"];
const SEARCH_RESULT_TITLE_KEYS = [...DOCUMENT_TITLE_KEYS, "ordinanceTitle", "자치법규명"];
const SEARCH_RESULT_JURISDICTION_KEYS = ["jurisdiction", "localGovernment", "region", "orgName", "기관명", "지자체명", "자치단체명"];
const SEARCH_RESULT_EFFECTIVE_DATE_KEYS = ["effectiveDate", "시행일자", "시행일", "efYd"];
const SEARCH_RESULT_PROMULGATION_DATE_KEYS = ["promulgationDate", "공포일자", "공포일"];
const SEARCH_RESULT_REFERENCE_URL_KEYS = ["url", "link", "detailUrl", "referenceUrl", "상세링크", "링크"];
const SEARCH_RESULT_SUMMARY_KEYS = ["summary", "description", "desc", "content", "본문", "내용"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickFirstString(record, keys) {
  if (!isPlainObject(record)) {
    return "";
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      return normalizeText(value);
    }
  }

  return "";
}

function collectStringFragments(value, fragments = [], depth = 0) {
  if (depth > 4 || value === null || value === undefined) {
    return fragments;
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (normalized) {
      fragments.push(normalized);
    }
    return fragments;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStringFragments(item, fragments, depth + 1));
    return fragments;
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach((item) => collectStringFragments(item, fragments, depth + 1));
  }

  return fragments;
}

function dedupeStrings(values) {
  const seen = new Set();
  const uniqueValues = [];

  values.forEach((value) => {
    if (!seen.has(value)) {
      seen.add(value);
      uniqueValues.push(value);
    }
  });

  return uniqueValues;
}

function looksLikeClauseRecord(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return Boolean(
    pickFirstString(value, CLAUSE_ID_KEYS) ||
      pickFirstString(value, CLAUSE_TITLE_KEYS) ||
      pickFirstString(value, CLAUSE_TEXT_KEYS)
  );
}

function findClauseList(value, depth = 0, visited = new Set()) {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (visited.has(value)) {
    return null;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => looksLikeClauseRecord(item))) {
      return value;
    }

    for (const item of value) {
      const nestedMatch = findClauseList(item, depth + 1, visited);
      if (nestedMatch) {
        return nestedMatch;
      }
    }

    return null;
  }

  for (const key of CLAUSE_LIST_KEYS) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  for (const child of Object.values(value)) {
    const nestedMatch = findClauseList(child, depth + 1, visited);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function findDocumentNode(value, depth = 0, visited = new Set()) {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (visited.has(value)) {
    return null;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedMatch = findDocumentNode(item, depth + 1, visited);
      if (nestedMatch) {
        return nestedMatch;
      }
    }

    return null;
  }

  if (CLAUSE_LIST_KEYS.some((key) => Array.isArray(value[key]))) {
    return value;
  }

  for (const child of Object.values(value)) {
    const nestedMatch = findDocumentNode(child, depth + 1, visited);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function parseClausesFromText(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  const sections = normalized
    .split(/(?=(?:^|\n)\s*(?:제\s*\d+\s*조(?:의\s*\d+)?|Article\s*\d+))/gm)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length <= 1) {
    return [
      {
        id: "clause-1",
        title: "Full Text",
        text: normalized
      }
    ];
  }

  return sections.map((section, index) => {
    const koreanMatch = section.match(/^(제\s*\d+\s*조(?:의\s*\d+)?)(?:\s*\(([^)]+)\))?/);
    const englishMatch = section.match(/^(Article\s*\d+)(?:\s*[-:]\s*([^\n]+))?/i);
    const id = normalizeText(koreanMatch?.[1] ?? englishMatch?.[1] ?? `clause-${index + 1}`);
    const title = normalizeText(koreanMatch?.[2] ?? englishMatch?.[2] ?? id);

    return {
      id,
      title,
      text: normalizeText(section)
    };
  });
}

function normalizeClause(rawClause, index) {
  const id = pickFirstString(rawClause, CLAUSE_ID_KEYS) || `clause-${index + 1}`;
  const title = pickFirstString(rawClause, CLAUSE_TITLE_KEYS) || id;
  const directText = pickFirstString(rawClause, CLAUSE_TEXT_KEYS);
  const fallbackText = dedupeStrings(collectStringFragments(rawClause))
    .filter((value) => value !== id && value !== title)
    .join(" ");
  const text = directText || normalizeText(fallbackText);

  return {
    id,
    title,
    text
  };
}

function pickDocumentCandidate(result) {
  if (isPlainObject(result?.structuredContent) || Array.isArray(result?.structuredContent)) {
    return result.structuredContent;
  }

  const textItems = Array.isArray(result?.content)
    ? result.content.filter((item) => item?.type === "text" && typeof item.text === "string")
    : [];

  for (const item of textItems) {
    try {
      const parsed = JSON.parse(item.text);
      if (parsed !== null && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Continue to plain-text fallback below.
    }
  }

  const combinedText = normalizeText(textItems.map((item) => item.text).join("\n"));
  return combinedText ? { text: combinedText } : null;
}

function normalizeDocument(candidate, fallbackVersion) {
  const documentNode = findDocumentNode(candidate) ?? candidate;
  const clausesFromObjects = findClauseList(documentNode);
  const clauses =
    clausesFromObjects?.map(normalizeClause).filter((clause) => clause.id && clause.title && clause.text) ??
    parseClausesFromText(
      pickFirstString(documentNode, TEXT_CONTENT_KEYS) || dedupeStrings(collectStringFragments(documentNode)).join("\n")
    );

  if (!Array.isArray(clauses) || clauses.length === 0) {
    throw new SourceResolutionError({
      code: "SOURCE_RESPONSE_INVALID",
      message: "Korea-law-mcp response did not include a usable regulation document.",
      statusCode: 502
    });
  }

  return {
    title: pickFirstString(documentNode, DOCUMENT_TITLE_KEYS) || fallbackVersion,
    version: pickFirstString(documentNode, DOCUMENT_VERSION_KEYS) || fallbackVersion,
    clauses
  };
}

function looksLikeSearchRecord(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return Boolean(
    pickFirstString(value, SEARCH_RESULT_ID_KEYS) ||
      pickFirstString(value, SEARCH_RESULT_TITLE_KEYS) ||
      pickFirstString(value, SEARCH_RESULT_JURISDICTION_KEYS)
  );
}

function findSearchResultList(value, depth = 0, visited = new Set()) {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (visited.has(value)) {
    return null;
  }
  visited.add(value);

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => looksLikeSearchRecord(item))) {
      return value;
    }

    for (const item of value) {
      const nestedMatch = findSearchResultList(item, depth + 1, visited);
      if (nestedMatch) {
        return nestedMatch;
      }
    }

    return null;
  }

  for (const key of SEARCH_RESULT_LIST_KEYS) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  for (const child of Object.values(value)) {
    const nestedMatch = findSearchResultList(child, depth + 1, visited);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function normalizeSearchResult(candidate) {
  const id = pickFirstString(candidate, SEARCH_RESULT_ID_KEYS);
  const title = pickFirstString(candidate, SEARCH_RESULT_TITLE_KEYS);

  if (!id && !title) {
    return null;
  }

  return {
    id,
    title: title || id,
    jurisdiction: pickFirstString(candidate, SEARCH_RESULT_JURISDICTION_KEYS),
    effectiveDate: pickFirstString(candidate, SEARCH_RESULT_EFFECTIVE_DATE_KEYS),
    promulgationDate: pickFirstString(candidate, SEARCH_RESULT_PROMULGATION_DATE_KEYS),
    referenceUrl: pickFirstString(candidate, SEARCH_RESULT_REFERENCE_URL_KEYS),
    summary: pickFirstString(candidate, SEARCH_RESULT_SUMMARY_KEYS)
  };
}

function normalizeSearchResults(candidate, limit) {
  const searchResults = findSearchResultList(candidate) ?? (Array.isArray(candidate) ? candidate : [candidate]);

  return searchResults
    .map(normalizeSearchResult)
    .filter((result) => result && result.id)
    .slice(0, limit);
}

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

function buildDetailToolCandidates(toolName) {
  const normalizedToolName = normalizeEnvValue(toolName);
  if (normalizedToolName) {
    return [normalizedToolName];
  }

  return [...DEFAULT_DETAIL_TOOL_NAMES];
}

function buildSearchToolCandidates(toolName) {
  const normalizedToolName = normalizeEnvValue(toolName);
  if (normalizedToolName) {
    return [normalizedToolName];
  }

  return [...DEFAULT_SEARCH_TOOL_NAMES];
}

function parseSearchLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 10);
}

function isMissingToolError(error, toolName) {
  const normalizedMessage = String(error instanceof Error ? error.message : error).toLowerCase();
  const normalizedToolName = toolName.toLowerCase();

  return (
    normalizedMessage.includes(`tool ${normalizedToolName} not found`) ||
    normalizedMessage.includes(`tool ${normalizedToolName} disabled`) ||
    (normalizedMessage.includes(`tool ${normalizedToolName}`) && normalizedMessage.includes("not found")) ||
    normalizedMessage.includes("unknown tool") ||
    normalizedMessage.includes("method not found")
  );
}

async function selectToolName(client, toolNames) {
  try {
    const toolList = await client.listTools();
    const availableToolNames = new Set((toolList?.tools ?? []).map((tool) => tool.name));
    return toolNames.find((toolName) => availableToolNames.has(toolName)) ?? toolNames[0];
  } catch {
    return toolNames[0];
  }
}

function resolveEndpoint(baseUrl) {
  try {
    const endpoint = new URL(baseUrl);
    if (endpoint.pathname === "/" || endpoint.pathname === "") {
      endpoint.pathname = "/mcp";
    }
    return endpoint;
  } catch {
    return null;
  }
}

async function fetchDocument({
  client,
  toolNames,
  idArgumentName,
  documentId,
  label
}) {
  let lastError = null;

  for (const toolName of toolNames) {
    try {
      const result = await client.callTool({
        name: toolName,
        arguments: {
          [idArgumentName]: documentId
        }
      });

      if (result?.isError) {
        const message = Array.isArray(result.content)
          ? result.content
              .filter((item) => item?.type === "text" && typeof item.text === "string")
              .map((item) => item.text)
              .join(" ")
              .trim()
          : "";

        if (toolNames.length > 1 && isMissingToolError(message, toolName)) {
          lastError = new Error(message || `Tool ${toolName} was not available.`);
          continue;
        }

        throw buildFetchError(`Korea-law-mcp rejected the ${label} document request.`, [
          {
            path: `source.${label}Id`,
            message: message || "tool returned an error result"
          }
        ]);
      }

      const candidate = pickDocumentCandidate(result);
      return {
        document: normalizeDocument(candidate, label),
        toolName
      };
    } catch (error) {
      if (error instanceof SourceResolutionError) {
        throw error;
      }

      if (toolNames.length > 1 && isMissingToolError(error, toolName)) {
        lastError = error;
        continue;
      }

      throw buildFetchError(`Failed to fetch the ${label} document from korea-law-mcp.`, [
        {
          path: `source.${label}Id`,
          message: error instanceof Error ? error.message : String(error)
        }
      ]);
    }
  }

  throw buildFetchError(`Failed to fetch the ${label} document from korea-law-mcp.`, [
    {
      path: `source.${label}Id`,
      message: lastError instanceof Error ? lastError.message : "No supported ordinance detail tool was available."
    }
  ]);
}

async function searchDocuments({
  client,
  toolNames,
  queryArgumentName,
  query,
  limit
}) {
  let lastError = null;

  for (const toolName of toolNames) {
    try {
      const result = await client.callTool({
        name: toolName,
        arguments: {
          [queryArgumentName]: query
        }
      });

      if (result?.isError) {
        const message = Array.isArray(result.content)
          ? result.content
              .filter((item) => item?.type === "text" && typeof item.text === "string")
              .map((item) => item.text)
              .join(" ")
              .trim()
          : "";

        if (toolNames.length > 1 && isMissingToolError(message, toolName)) {
          lastError = new Error(message || `Tool ${toolName} was not available.`);
          continue;
        }

        throw buildFetchError("Korea-law-mcp rejected the ordinance search request.", [
          {
            path: "query",
            message: message || "tool returned an error result"
          }
        ]);
      }

      const candidate = pickDocumentCandidate(result);
      return {
        results: normalizeSearchResults(candidate, limit),
        toolName
      };
    } catch (error) {
      if (error instanceof SourceResolutionError) {
        throw error;
      }

      if (toolNames.length > 1 && isMissingToolError(error, toolName)) {
        lastError = error;
        continue;
      }

      throw buildFetchError("Failed to search ordinances from korea-law-mcp.", [
        {
          path: "query",
          message: error instanceof Error ? error.message : String(error)
        }
      ]);
    }
  }

  throw buildFetchError("Failed to search ordinances from korea-law-mcp.", [
    {
      path: "query",
      message: lastError instanceof Error ? lastError.message : "No supported ordinance search tool was available."
    }
  ]);
}

export function createKoreaLawMcpSource({
  baseUrl = process.env.KOREA_LAW_MCP_BASE_URL,
  toolName = process.env.KOREA_LAW_MCP_DETAIL_TOOL_NAME,
  idArgumentName = process.env.KOREA_LAW_MCP_ID_ARGUMENT_NAME,
  searchToolName = process.env.KOREA_LAW_MCP_SEARCH_TOOL_NAME,
  searchQueryArgumentName = process.env.KOREA_LAW_MCP_SEARCH_QUERY_ARGUMENT_NAME
} = {}) {
  const normalizedBaseUrl = normalizeEnvValue(baseUrl);
  const resolvedDetailToolNames = buildDetailToolCandidates(toolName);
  const resolvedSearchToolNames = buildSearchToolCandidates(searchToolName);
  const resolvedIdArgumentName = normalizeEnvValue(idArgumentName) || DEFAULT_ID_ARGUMENT_NAME;
  const resolvedSearchQueryArgumentName = normalizeEnvValue(searchQueryArgumentName) || DEFAULT_SEARCH_QUERY_ARGUMENT_NAME;

  if (!normalizedBaseUrl) {
    return {
      getSourceStatus() {
        return buildSourceStatus({
          provider: "korea-law-mcp",
          enabled: false,
          mode: "adapter",
          missingEnv: REQUIRED_ENV,
          transport: "streamable-http",
          detailToolNames: resolvedDetailToolNames,
          idArgumentName: resolvedIdArgumentName,
          searchToolNames: resolvedSearchToolNames,
          searchQueryArgumentName: resolvedSearchQueryArgumentName
        });
      },
      async resolveRegulationPair() {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_MISCONFIGURED",
          message: "Source provider is missing required environment variables.",
          details: REQUIRED_ENV.map((name) => ({
            path: `env.${name}`,
            message: "is required"
          }))
        });
      },
      async searchRegulations() {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_MISCONFIGURED",
          message: "Source provider is missing required environment variables.",
          details: REQUIRED_ENV.map((name) => ({
            path: `env.${name}`,
            message: "is required"
          }))
        });
      }
    };
  }

  const endpoint = resolveEndpoint(normalizedBaseUrl);

  if (!endpoint) {
    return {
      getSourceStatus() {
        return buildSourceStatus({
          provider: "korea-law-mcp",
          enabled: false,
          mode: "adapter",
          missingEnv: [],
          transport: "streamable-http",
          detailToolNames: resolvedDetailToolNames,
          idArgumentName: resolvedIdArgumentName,
          searchToolNames: resolvedSearchToolNames,
          searchQueryArgumentName: resolvedSearchQueryArgumentName
        });
      },
      async resolveRegulationPair() {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_MISCONFIGURED",
          message: "KOREA_LAW_MCP_BASE_URL must be a valid URL.",
          details: [
            {
              path: "env.KOREA_LAW_MCP_BASE_URL",
              message: "must be a valid URL"
            }
          ]
        });
      },
      async searchRegulations() {
        throw new SourceResolutionError({
          code: "SOURCE_PROVIDER_MISCONFIGURED",
          message: "KOREA_LAW_MCP_BASE_URL must be a valid URL.",
          details: [
            {
              path: "env.KOREA_LAW_MCP_BASE_URL",
              message: "must be a valid URL"
            }
          ]
        });
      }
    };
  }

  const status = buildSourceStatus({
    provider: "korea-law-mcp",
    enabled: true,
    mode: "adapter",
    transport: "streamable-http",
    endpoint: endpoint.toString(),
    detailToolNames: resolvedDetailToolNames,
    idArgumentName: resolvedIdArgumentName,
    searchToolNames: resolvedSearchToolNames,
    searchQueryArgumentName: resolvedSearchQueryArgumentName
  });

  return {
    getSourceStatus() {
      return status;
    },
    async probeConnection() {
      const client = new Client({
        name: "ai-rookie-law-source",
        version: "0.1.0"
      });

      const transport = new StreamableHTTPClientTransport(endpoint);

      try {
        await client.connect(transport);
        const toolList = await client.listTools();
        const availableToolNames = (toolList?.tools ?? []).map((tool) => tool.name).filter(Boolean);
        const availableDetailToolNames = resolvedDetailToolNames.filter((name) => availableToolNames.includes(name));
        const availableSearchToolNames = resolvedSearchToolNames.filter((name) => availableToolNames.includes(name));

        return {
          success: true,
          provider: "korea-law-mcp",
          endpoint: endpoint.toString(),
          transport: "streamable-http",
          availableToolCount: availableToolNames.length,
          availableDetailToolNames,
          availableSearchToolNames,
          selectedDetailToolName: availableDetailToolNames[0] ?? resolvedDetailToolNames[0] ?? "",
          selectedSearchToolName: availableSearchToolNames[0] ?? resolvedSearchToolNames[0] ?? "",
          idArgumentName: resolvedIdArgumentName,
          searchQueryArgumentName: resolvedSearchQueryArgumentName
        };
      } catch (error) {
        return {
          success: false,
          provider: "korea-law-mcp",
          endpoint: endpoint.toString(),
          transport: "streamable-http",
          error: error instanceof Error ? error.message : String(error)
        };
      } finally {
        await client.close();
      }
    },
    async searchRegulations(input = {}) {
      const query = normalizeEnvValue(input.query);
      const limit = parseSearchLimit(input.limit);

      if (!query) {
        throw buildSourceInputError([{ path: "query", message: "is required" }]);
      }

      const client = new Client({
        name: "ai-rookie-law-source",
        version: "0.1.0"
      });

      const transport = new StreamableHTTPClientTransport(endpoint);

      try {
        await client.connect(transport);
        const selectedToolName = await selectToolName(client, resolvedSearchToolNames);
        const orderedToolNames = [selectedToolName, ...resolvedSearchToolNames.filter((name) => name !== selectedToolName)];
        const searchResolution = await searchDocuments({
          client,
          toolNames: orderedToolNames,
          queryArgumentName: resolvedSearchQueryArgumentName,
          query,
          limit
        });

        return {
          results: searchResolution.results,
          meta: {
            provider: "korea-law-mcp",
            mode: "adapter",
            endpoint: endpoint.toString(),
            toolName: searchResolution.toolName,
            queryArgumentName: resolvedSearchQueryArgumentName
          }
        };
      } finally {
        await client.close();
      }
    },
    async resolveRegulationPair(input = {}) {
      const beforeId = normalizeEnvValue(input.beforeId);
      const afterId = normalizeEnvValue(input.afterId);
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

      const client = new Client({
        name: "ai-rookie-law-source",
        version: "0.1.0"
      });

      const transport = new StreamableHTTPClientTransport(endpoint);

      try {
        await client.connect(transport);
        const selectedToolName = await selectToolName(client, resolvedDetailToolNames);
        const orderedToolNames = [selectedToolName, ...resolvedDetailToolNames.filter((name) => name !== selectedToolName)];

        const beforeResolution = await fetchDocument({
          client,
          toolNames: orderedToolNames,
          idArgumentName: resolvedIdArgumentName,
          documentId: beforeId,
          label: "before"
        });
        const afterResolution = await fetchDocument({
          client,
          toolNames: [beforeResolution.toolName],
          idArgumentName: resolvedIdArgumentName,
          documentId: afterId,
          label: "after"
        });

        return {
          beforeDoc: beforeResolution.document,
          afterDoc: afterResolution.document,
          meta: {
            provider: "korea-law-mcp",
            mode: "adapter",
            endpoint: endpoint.toString(),
            beforeId,
            afterId,
            toolName: beforeResolution.toolName,
            idArgumentName: resolvedIdArgumentName
          }
        };
      } finally {
        await client.close();
      }
    }
  };
}
