import { createKoreaLawMcpSource } from "./providers/koreaLawMcpSource.js";
import { createLocalFixtureLawSource } from "./providers/localFixtureLawSource.js";
import { createUnavailableLawSource, normalizeEnvValue, SourceResolutionError } from "./shared.js";

export { SourceResolutionError };

export function resolveLawSourceProvider({
  provider = process.env.LAW_SOURCE_PROVIDER
} = {}) {
  const normalizedProvider = normalizeEnvValue(provider).toLowerCase();
  return normalizedProvider || "local-fixture";
}

export function createLawSource({
  provider = process.env.LAW_SOURCE_PROVIDER,
  koreaLawMcpBaseUrl = process.env.KOREA_LAW_MCP_BASE_URL,
  koreaLawMcpToolName = process.env.KOREA_LAW_MCP_DETAIL_TOOL_NAME,
  koreaLawMcpIdArgumentName = process.env.KOREA_LAW_MCP_ID_ARGUMENT_NAME,
  koreaLawMcpSearchToolName = process.env.KOREA_LAW_MCP_SEARCH_TOOL_NAME,
  koreaLawMcpSearchQueryArgumentName = process.env.KOREA_LAW_MCP_SEARCH_QUERY_ARGUMENT_NAME
} = {}) {
  const resolvedProvider = resolveLawSourceProvider({ provider });

  if (resolvedProvider === "local-fixture") {
    return createLocalFixtureLawSource();
  }

  if (resolvedProvider === "korea-law-mcp") {
    return createKoreaLawMcpSource({
      baseUrl: koreaLawMcpBaseUrl,
      toolName: koreaLawMcpToolName,
      idArgumentName: koreaLawMcpIdArgumentName,
      searchToolName: koreaLawMcpSearchToolName,
      searchQueryArgumentName: koreaLawMcpSearchQueryArgumentName
    });
  }

  return createUnavailableLawSource({
    provider: "unsupported",
    reason: "unsupported_provider"
  });
}

export function getLawSourceStatus(options = {}) {
  return createLawSource(options).getSourceStatus();
}

export async function searchLawSource(options = {}) {
  return createLawSource(options).searchRegulations({
    query: options.query,
    limit: options.limit
  });
}
