import { createUnavailableLawSource, normalizeEnvValue } from "../shared.js";

const REQUIRED_ENV = ["KOREA_LAW_MCP_BASE_URL"];

export function createKoreaLawMcpSource({
  baseUrl = process.env.KOREA_LAW_MCP_BASE_URL
} = {}) {
  const normalizedBaseUrl = normalizeEnvValue(baseUrl);

  if (!normalizedBaseUrl) {
    return createUnavailableLawSource({
      provider: "korea-law-mcp",
      reason: "missing_env",
      missingEnv: REQUIRED_ENV
    });
  }

  return createUnavailableLawSource({
    provider: "korea-law-mcp",
    reason: "not_implemented"
  });
}
