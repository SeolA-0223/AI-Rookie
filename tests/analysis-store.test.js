import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalysisRunRecord,
  createAnalysisStore,
  detectRunSource,
  parseHistoryLimit,
  resolveStorageProvider
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

test("resolveStorageProvider defaults to local without explicit provider or Supabase URL", () => {
  assert.equal(resolveStorageProvider({ provider: "", url: "" }), "local");
});

test("resolveStorageProvider auto-detects Supabase when URL is present", () => {
  assert.equal(
    resolveStorageProvider({
      provider: "",
      url: "https://pxqfnokmxqcilohnsseb.supabase.co"
    }),
    "supabase"
  );
});

test("createAnalysisStore returns local store when provider is local", async () => {
  const store = createAnalysisStore({ provider: "local" });
  const storage = store.getStorageStatus();
  const history = await store.listRecentRuns();
  const saveResult = await store.saveRun({});

  assert.equal(storage.provider, "local");
  assert.equal(storage.enabled, false);
  assert.deepEqual(storage.missingEnv, []);
  assert.deepEqual(history.runs, []);
  assert.equal(saveResult.saved, false);
  assert.equal(saveResult.reason, "storage_disabled");
});

test("createAnalysisStore reports missing Supabase credentials when provider is supabase", async () => {
  const store = createAnalysisStore({
    provider: "supabase",
    url: "",
    serviceRoleKey: ""
  });
  const storage = store.getStorageStatus();
  const saveResult = await store.saveRun({});

  assert.equal(storage.provider, "supabase");
  assert.equal(storage.enabled, false);
  assert.deepEqual(storage.missingEnv, ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  assert.equal(saveResult.saved, false);
  assert.equal(saveResult.reason, "missing_env");
});

test("createAnalysisStore exposes Supabase status when credentials are present", () => {
  const store = createAnalysisStore({
    provider: "supabase",
    url: "https://pxqfnokmxqcilohnsseb.supabase.co",
    serviceRoleKey: "service-role-key"
  });
  const storage = store.getStorageStatus();

  assert.equal(storage.provider, "supabase");
  assert.equal(storage.enabled, true);
  assert.equal(storage.projectRef, "pxqfnokmxqcilohnsseb");
  assert.deepEqual(storage.missingEnv, []);
});

test("createAnalysisStore reserves municipal provider for future database adapter", async () => {
  const store = createAnalysisStore({
    provider: "municipal",
    municipalConnectionString: "postgres://city-user:secret@city-db.example/internal"
  });
  const storage = store.getStorageStatus();
  const saveResult = await store.saveRun({});

  assert.equal(storage.provider, "municipal");
  assert.equal(storage.enabled, false);
  assert.deepEqual(storage.missingEnv, []);
  assert.equal(saveResult.saved, false);
  assert.equal(saveResult.reason, "not_implemented");
});

test("createAnalysisStore rejects unsupported providers without breaking the API", async () => {
  const store = createAnalysisStore({ provider: "oracle" });
  const storage = store.getStorageStatus();
  const saveResult = await store.saveRun({});

  assert.equal(storage.provider, "unsupported");
  assert.equal(storage.enabled, false);
  assert.equal(saveResult.saved, false);
  assert.equal(saveResult.reason, "unsupported_provider");
});

test("buildAnalysisRunRecord shapes the row stored in the configured database", () => {
  const result = {
    meta: {
      totalChanges: 4,
      highRiskChangeCount: 2,
      changeTypeBreakdown: {
        obligation: 2,
        deadline: 2
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
  assert.deepEqual(record.change_type_breakdown, { obligation: 2, deadline: 2 });
  assert.equal(record.response_payload, result);
});
