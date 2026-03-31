import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detectChanges } from "../backend/src/changeDetection/detectChanges.js";
import { mapImpactDocuments } from "../backend/src/mapping/mapImpactDocuments.js";
import { classifyRisk } from "../backend/src/risk/classifyRisk.js";
import { buildTrace } from "../backend/src/trace/buildTrace.js";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const before = readJson("data/samples/regulation_before.json");
const after = readJson("data/samples/regulation_after.json");
const docs = readJson("data/samples/internal_docs.json");

test("mapImpactDocuments returns linked docs for each change", () => {
  const changes = detectChanges(before.clauses, after.clauses);
  const mapped = mapImpactDocuments(changes, docs);

  assert.equal(mapped.length, changes.length);
  mapped.forEach((item) => {
    assert.ok(item.impactedDocuments.length >= 1);
  });
});

test("classifyRisk and buildTrace produce explainable output", () => {
  const changes = detectChanges(before.clauses, after.clauses);
  const mapped = mapImpactDocuments(changes, docs);

  const first = mapped[0];
  const risk = classifyRisk(first.changeType, first.impactedDocuments);
  const trace = buildTrace(changes.find((c) => c.id === first.changeId), first.impactedDocuments, risk);

  assert.ok(["빨강", "노랑", "파랑"].includes(risk.level));
  assert.ok(trace.evidence.before || trace.evidence.after);
  assert.ok(trace.impactedDocumentIds.length >= 1);
});
