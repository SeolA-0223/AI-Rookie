import { createLocalStore } from "./providers/localStore.js";
import { createMunicipalStore } from "./providers/municipalStore.js";
import { createSupabaseStore } from "./providers/supabaseStore.js";
import {
  buildAnalysisRunRecord,
  detectRunSource,
  normalizeEnvValue,
  parseHistoryLimit,
  createPassiveStore
} from "./shared.js";

export { buildAnalysisRunRecord, detectRunSource, parseHistoryLimit };

export function resolveStorageProvider({
  provider = process.env.STORAGE_PROVIDER,
  url = process.env.SUPABASE_URL
} = {}) {
  const normalizedProvider = normalizeEnvValue(provider).toLowerCase();
  if (normalizedProvider) {
    return normalizedProvider;
  }

  return normalizeEnvValue(url) ? "supabase" : "local";
}

export function createAnalysisStore({
  provider = process.env.STORAGE_PROVIDER,
  url = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  municipalConnectionString = process.env.MUNICIPAL_DB_CONNECTION_STRING
} = {}) {
  const resolvedProvider = resolveStorageProvider({ provider, url });

  if (resolvedProvider === "local") {
    return createLocalStore();
  }

  if (resolvedProvider === "supabase") {
    return createSupabaseStore({ url, serviceRoleKey });
  }

  if (resolvedProvider === "municipal") {
    return createMunicipalStore({
      connectionString: municipalConnectionString
    });
  }

  return createPassiveStore({
    provider: "unsupported",
    reason: "unsupported_provider"
  });
}
