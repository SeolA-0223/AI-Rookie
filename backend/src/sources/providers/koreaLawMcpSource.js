import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  buildSourceStatus,
  normalizeEnvValue,
  SourceResolutionError
} from "../shared.js";

const REQUIRED_ENV = ["KOREA_LAW_MCP_BASE_URL"];
const DEFAULT_DETAIL_TOOL_NAMES = ["get_local_ordinance_detail", "get_ordinance_detail"];
const DEFAULT_ID_ARGUMENT_NAME = "ID";
const CLAUSE_LIST_KEYS = ["clauses", "articles", "articleList", "items", "rows", "조문", "조문목록", "joMunList"];
const DOCUMENT_TITLE_KEYS = ["title", "name", "documentTitle", "ordinanceName", "lawName", "자치법규명", "법령명"];
const DOCUMENT_VERSION_KEYS = ["version", "revision", "effectiveDate", "시행일", "공포일", "date"];
const CLAUSE_ID_KEYS = ["id", "ID", "articleId", "articleNo", "clauseId", "joNo", "조문번호", "번호"];
const CLAUSE_TITLE_KEYS = ["title", "name", "articleTitle", "clauseTitle", "heading", "제목", "조문제목"];
const CLAUSE_TEXT_KEYS = ["text", "content", "articleText", "clauseText", "body", "본문", "내용", "조문내용"];
const TEXT_CONTENT_KEYS = [...CLAUSE_TEXT_KEYS, "fullText", "documentText", "rawText", "전문"];

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
  if (isPlainObject(result?.structuredContent)) {
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

function buildToolCandidates(toolName) {
  const normalizedToolName = normalizeEnvValue(toolName);
  if (normalizedToolName) {
    return [normalizedToolName];
  }

  return [...DEFAULT_DETAIL_TOOL_NAMES];
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

export function createKoreaLawMcpSource({
  baseUrl = process.env.KOREA_LAW_MCP_BASE_URL,
  toolName = process.env.KOREA_LAW_MCP_DETAIL_TOOL_NAME,
  idArgumentName = process.env.KOREA_LAW_MCP_ID_ARGUMENT_NAME
} = {}) {
  const normalizedBaseUrl = normalizeEnvValue(baseUrl);
  const resolvedToolNames = buildToolCandidates(toolName);
  const resolvedIdArgumentName = normalizeEnvValue(idArgumentName) || DEFAULT_ID_ARGUMENT_NAME;

  if (!normalizedBaseUrl) {
    return {
      getSourceStatus() {
        return buildSourceStatus({
          provider: "korea-law-mcp",
          enabled: false,
          mode: "adapter",
          missingEnv: REQUIRED_ENV
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
          missingEnv: []
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
      }
    };
  }

  const status = buildSourceStatus({
    provider: "korea-law-mcp",
    enabled: true,
    mode: "adapter"
  });

  return {
    getSourceStatus() {
      return status;
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
        const selectedToolName = await selectToolName(client, resolvedToolNames);
        const orderedToolNames = [selectedToolName, ...resolvedToolNames.filter((name) => name !== selectedToolName)];

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
            beforeId,
            afterId,
            toolName: beforeResolution.toolName
          }
        };
      } finally {
        await client.close();
      }
    }
  };
}
