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
  koreaLawMcpBaseUrl = process.env.KOREA_LAW_MCP_BASE_URL
} = {}) {
  const resolvedProvider = resolveLawSourceProvider({ provider });

  if (resolvedProvider === "local-fixture") {
    return createLocalFixtureLawSource();
  }

  if (resolvedProvider === "korea-law-mcp") {
    return createKoreaLawMcpSource({ baseUrl: koreaLawMcpBaseUrl });
  }

  return createUnavailableLawSource({
    provider: "unsupported",
    reason: "unsupported_provider"
  });
}
