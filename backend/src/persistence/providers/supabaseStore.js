import { createClient } from "@supabase/supabase-js";
import {
  ANALYSIS_RUNS_TABLE,
  buildAnalysisRunRecord,
  buildStorageStatus,
  createPassiveStore,
  deriveProjectRef,
  mapHistoryRow,
  normalizeEnvValue
} from "../shared.js";

export function createSupabaseStore({
  url = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
} = {}) {
  const normalizedUrl = normalizeEnvValue(url);
  const normalizedKey = normalizeEnvValue(serviceRoleKey);
  const missingEnv = [];

  if (!normalizedUrl) {
    missingEnv.push("SUPABASE_URL");
  }
  if (!normalizedKey) {
    missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missingEnv.length > 0) {
    return createPassiveStore({
      provider: "supabase",
      reason: "missing_env",
      missingEnv,
      projectRef: deriveProjectRef(normalizedUrl)
    });
  }

  const client = createClient(normalizedUrl, normalizedKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const storage = buildStorageStatus({
    provider: "supabase",
    enabled: true,
    projectRef: deriveProjectRef(normalizedUrl)
  });

  return {
    getStorageStatus() {
      return storage;
    },
    async saveRun({ source, requestPayload, result }) {
      const record = buildAnalysisRunRecord({ source, requestPayload, result });
      const { data, error } = await client
        .from(ANALYSIS_RUNS_TABLE)
        .insert(record)
        .select("id, created_at")
        .single();

      if (error) {
        return {
          saved: false,
          reason: "write_failed",
          message: error.message
        };
      }

      return {
        saved: true,
        runId: data.id,
        createdAt: data.created_at
      };
    },
    async listRecentRuns(limit = 10) {
      const { data, error } = await client
        .from(ANALYSIS_RUNS_TABLE)
        .select(
          "id, created_at, source, total_changes, high_risk_change_count, change_type_breakdown, response_payload"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          storage,
          runs: [],
          error: {
            code: "SUPABASE_READ_FAILED",
            message: error.message
          }
        };
      }

      return {
        storage,
        runs: data.map(mapHistoryRow)
      };
    }
  };
}
