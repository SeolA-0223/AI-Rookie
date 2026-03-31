import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runPipeline } from "../backend/src/pipeline/runPipeline.js";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const beforeDoc = readJson("data/samples/regulation_before.json");
const afterDoc = readJson("data/samples/regulation_after.json");
const internalDocs = readJson("data/samples/internal_docs.json");

test("runPipeline returns integrated result shape", () => {
  const result = runPipeline({ beforeDoc, afterDoc, internalDocs });

  assert.equal(result.changes.length, 4);
  assert.equal(result.mapped.length, 4);
  assert.equal(result.risks.length, 4);
  assert.equal(result.traces.length, 4);
  assert.ok(result.drafts.internalNoticeDraft.includes("Internal Notice Draft"));
});
