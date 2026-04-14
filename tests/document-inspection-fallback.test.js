import test from "node:test";
import assert from "node:assert/strict";
import { inspectDocumentAgainstLatestOrdinance } from "../backend/src/inspection/inspectDocumentAgainstLatestOrdinance.js";

test("inspectDocumentAgainstLatestOrdinance falls back to the bundled Daejeon Dong-gu ordinance when live search fails", async () => {
  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "# 대전광역시 동구 청년 기본 조례 안내문(테스트용)\n\n지원 대상은 만 19세 이상 34세 이하의 청년으로 한다.",
      fileName: "daejeon-donggu-youth-basic-guide.md",
      municipalities: []
    },
    {
      env: {},
      discoverLawSourceFn: async () => {
        throw new Error("discover failed");
      },
      searchLawSourceFn: async () => {
        throw new Error("search failed");
      },
      readLawSourceDocumentFn: async () => {
        throw new Error("read should not be called");
      },
      recommendLawSourcePairFn: () => null,
      now: () => "2026-04-14T00:00:00.000Z"
    }
  );

  assert.equal(result.meta.generatedAt, "2026-04-14T00:00:00.000Z");
  assert.equal(result.meta.search.route, "bundled-fallback");
  assert.equal(result.ordinance.matched.id, "2118913");
  assert.equal(result.ordinance.matched.title, "대전광역시 동구 청년 기본 조례");
  assert.equal(result.download.fileName, "daejeon-donggu-youth-basic-guide.md-revision.md");
  assert.ok(Array.isArray(result.review.issues));
  assert.ok(result.review.issues.length >= 1);
});
