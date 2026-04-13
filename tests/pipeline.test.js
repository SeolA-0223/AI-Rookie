import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PipelineValidationError, runPipeline } from "../backend/src/pipeline/runPipeline.js";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const beforeDoc = readJson("data/samples/regulation_before.json");
const afterDoc = readJson("data/samples/regulation_after.json");
const internalDocs = readJson("data/samples/internal_docs.json");

test("runPipeline returns integrated result shape", () => {
  const result = runPipeline({ beforeDoc, afterDoc, internalDocs });

  assert.equal(result.meta.schemaVersion, "1.0.0");
  assert.equal(result.meta.totalChanges, 4);
  assert.equal(result.analysis.changes.length, 4);
  assert.equal(result.analysis.impactedDocuments.length, 4);
  assert.equal(result.analysis.risks.length, 4);
  assert.equal(result.analysis.traces.length, 4);

  // Legacy fields are still exposed for backwards compatibility.
  assert.equal(result.changes.length, 4);
  assert.equal(result.mapped.length, 4);
  assert.equal(result.risks.length, 4);
  assert.equal(result.traces.length, 4);
  assert.ok(result.drafts.internalNoticeDraft.includes("[내부 공지 초안]"));
});

test("runPipeline validates input payload shape", () => {
  assert.throws(
    () =>
      runPipeline({
        beforeDoc: {},
        afterDoc: { clauses: [] },
        internalDocs: []
      }),
    (error) => error instanceof PipelineValidationError && error.details.length > 0
  );
});
