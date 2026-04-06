import { createClient } from "@supabase/supabase-js";

const ANALYSIS_RUNS_TABLE = "analysis_runs";
const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 20;

function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function deriveProjectRef(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export function parseHistoryLimit(input) {
  const value = Number.parseInt(input ?? "", 10);
  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_HISTORY_LIMIT;
  }
  return Math.min(value, MAX_HISTORY_LIMIT);
}

export function detectRunSource(payload = {}) {
  return Object.keys(payload).length > 0 ? "custom" : "sample";
}

export function buildAnalysisRunRecord({ source, requestPayload, result }) {
  return {
    source,
    total_changes: result.meta.totalChanges,
    high_risk_change_count: result.meta.highRiskChangeCount,
    change_type_breakdown: result.meta.changeTypeBreakdown,
    input_payload: requestPayload,
    response_payload: result
  };
}

function mapHistoryRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    totalChanges: row.total_changes,
    highRiskChangeCount: row.high_risk_change_count,
    changeTypeBreakdown: row.change_type_breakdown ?? {},
    result: row.response_payload
  };
}

function buildStorageStatus({ enabled, url = "", missingEnv = [] }) {
  return {
    enabled,
    provider: enabled ? "supabase" : "local",
    projectRef: enabled ? deriveProjectRef(url) : null,
    missingEnv
  };
}

function createDisabledStore(missingEnv) {
  const storage = buildStorageStatus({ enabled: false, missingEnv });

  return {
    getStorageStatus() {
      return storage;
    },
    async saveRun() {
      return {
        saved: false,
        reason: "missing_env"
      };
    },
    async listRecentRuns() {
      return {
        storage,
        runs: []
      };
    }
  };
}

function createSupabaseStore(url, serviceRoleKey) {
  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const storage = buildStorageStatus({ enabled: true, url });

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
    async listRecentRuns(limit = DEFAULT_HISTORY_LIMIT) {
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

export function createAnalysisStore({
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
    return createDisabledStore(missingEnv);
  }

  return createSupabaseStore(normalizedUrl, normalizedKey);
}
