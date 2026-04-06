import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalysisRunRecord,
  createAnalysisStore,
  detectRunSource,
  parseHistoryLimit
} from "../backend/src/persistence/analysisStore.js";

test("parseHistoryLimit clamps to supported bounds", () => {
  assert.equal(parseHistoryLimit("3"), 3);
  assert.equal(parseHistoryLimit("0"), 10);
  assert.equal(parseHistoryLimit("999"), 20);
  assert.equal(parseHistoryLimit("abc"), 10);
});

test("detectRunSource distinguishes sample and custom payloads", () => {
  assert.equal(detectRunSource({}), "sample");
  assert.equal(detectRunSource({ before: { clauses: [] } }), "custom");
});

test("createAnalysisStore falls back to local mode without credentials", async () => {
  const store = createAnalysisStore({ url: "", serviceRoleKey: "" });
  const storage = store.getStorageStatus();
  const history = await store.listRecentRuns();
  const saveResult = await store.saveRun({});

  assert.equal(storage.enabled, false);
  assert.deepEqual(storage.missingEnv, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  assert.deepEqual(history.runs, []);
  assert.equal(saveResult.saved, false);
});

test("buildAnalysisRunRecord shapes the row stored in Supabase", () => {
  const result = {
    meta: {
      totalChanges: 4,
      highRiskChangeCount: 2,
      changeTypeBreakdown: {
        요건: 2,
        기한: 2
      }
    },
    analysis: {
      changes: []
    }
  };

  const record = buildAnalysisRunRecord({
    source: "sample",
    requestPayload: {
      before: { clauses: [] },
      after: { clauses: [] },
      internalDocs: []
    },
    result
  });

  assert.equal(record.source, "sample");
  assert.equal(record.total_changes, 4);
  assert.equal(record.high_risk_change_count, 2);
  assert.deepEqual(record.change_type_breakdown, { 요건: 2, 기한: 2 });
  assert.equal(record.response_payload, result);
});
