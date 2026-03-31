import test from "node:test";
import assert from "node:assert/strict";
import { generateDrafts } from "../backend/src/generation/generateDrafts.js";

const changes = [
  {
    id: "c1",
    changeType: "요건",
    title: "Age Requirement",
    beforeText: "19-29",
    afterText: "19-34"
  },
  {
    id: "c2",
    changeType: "서류",
    title: "Required Documents",
    beforeText: "ID + registration",
    afterText: "ID + registration + income proof"
  }
];

const risks = [
  { changeId: "c1", risk: { level: "빨강", reason: "high impact" } },
  { changeId: "c2", risk: { level: "노랑", reason: "document risk" } }
];

test("generateDrafts returns three drafts and comparison table", () => {
  const drafts = generateDrafts(changes, risks);
  assert.ok(drafts.internalNoticeDraft.includes("High risk items: 1"));
  assert.ok(drafts.citizenGuideDraft.includes("Age Requirement"));
  assert.ok(drafts.faqDraft.includes("What changed?"));
  assert.ok(drafts.comparisonTable.includes("| Type | Clause | Before | After |"));
});
