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
  assert.ok(drafts.internalNoticeDraft.includes("고위험 항목 수: 1"));
  assert.ok(drafts.citizenGuideDraft.includes("연령 요건"));
  assert.ok(drafts.faqDraft.includes("Q. 무엇이 바뀌었나요?"));
  assert.ok(drafts.comparisonTable.includes("| 유형 | 조항 | 변경 요약 |"));
});
