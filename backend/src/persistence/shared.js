export const ANALYSIS_RUNS_TABLE = "analysis_runs";
const DEFAULT_HISTORY_LIMIT = 10;
const MAX_HISTORY_LIMIT = 20;

export function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function deriveProjectRef(url) {
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

export function mapHistoryRow(row) {
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

export function buildStorageStatus({
  provider,
  enabled,
  projectRef = null,
  missingEnv = []
}) {
  return {
    enabled,
    provider,
    projectRef,
    missingEnv
  };
}

export function createPassiveStore({
  provider,
  reason,
  enabled = false,
  projectRef = null,
  missingEnv = []
}) {
  const storage = buildStorageStatus({
    provider,
    enabled,
    projectRef,
    missingEnv
  });

  return {
    getStorageStatus() {
      return storage;
    },
    async saveRun() {
      return {
        saved: false,
        reason
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
