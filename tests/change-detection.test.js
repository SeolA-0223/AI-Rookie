import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { detectChanges } from "../backend/src/changeDetection/detectChanges.js";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const before = readJson("data/samples/regulation_before.json");
const after = readJson("data/samples/regulation_after.json");

test("detectChanges identifies four update types", () => {
  const changes = detectChanges(before.clauses, after.clauses);

  assert.equal(changes.length, 4);
  assert.deepEqual(
    changes.map((item) => item.changeType).sort(),
    ["금액", "기한", "서류", "요건"].sort()
  );
});

test("detectChanges creates readable summaries", () => {
  const changes = detectChanges(before.clauses, after.clauses);
  for (const change of changes) {
    assert.ok(change.summary.includes("changed") || change.summary.includes("Clause"));
  }
});
