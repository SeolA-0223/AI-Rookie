import { createPassiveStore, normalizeEnvValue } from "../shared.js";

const REQUIRED_ENV = ["MUNICIPAL_DB_CONNECTION_STRING"];

export function createMunicipalStore({
  connectionString = process.env.MUNICIPAL_DB_CONNECTION_STRING
} = {}) {
  const normalizedConnectionString = normalizeEnvValue(connectionString);

  if (!normalizedConnectionString) {
    return createPassiveStore({
      provider: "municipal",
      reason: "missing_env",
      missingEnv: REQUIRED_ENV
    });
  }

  return createPassiveStore({
    provider: "municipal",
    reason: "not_implemented"
  });
}
