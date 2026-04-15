import test from "node:test";
import assert from "node:assert/strict";
import { inspectDocumentAgainstLatestOrdinance } from "../backend/src/inspection/inspectDocumentAgainstLatestOrdinance.js";

function createLatestMatch() {
  return {
    id: "1840747",
    title: "서울특별시 청년 기본 조례",
    jurisdiction: "서울특별시",
    promulgationDate: "2026-04-10",
    effectiveDate: "2026-04-10",
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=1840747",
    current: true
  };
}

function createLatestDocument() {
  return {
    document: {
      title: "서울특별시 청년 기본 조례",
      version: "서울특별시조례 제9999호",
      clauses: [
        {
          id: "c1",
          title: "제2조 지원대상",
          text: "지원대상은 만 19세 이상 34세 이하 청년으로 한다."
        }
      ]
    },
    meta: {
      id: "1840747",
      referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=1840747"
    }
  };
}

test("document inspection prefers title search matches over unrelated discovery results", async () => {
  let searchArgs = null;
  const searchMatch = createLatestMatch();
  const unrelatedDiscoveryMatch = {
    id: "9000001",
    title: "서울특별시 종로구 마을버스 재정지원에 관한 조례",
    jurisdiction: "서울특별시 종로구",
    promulgationDate: "2026-04-12",
    effectiveDate: "2026-04-12",
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=9000001",
    current: true
  };

  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "서울특별시 청년 기본 조례 안내문\n지원 대상은 만 19세 이상 29세 이하 청년입니다.",
      fileName: "seoul-youth-guide.md",
      municipalities: ["6110000"]
    },
    {
      env: {},
      discoverLawSourceFn: async () => ({
        results: [unrelatedDiscoveryMatch],
        meta: {
          mode: "discover",
          route: "discover"
        }
      }),
      searchLawSourceFn: async (input) => {
        searchArgs = input;
        return {
          results: [searchMatch],
          meta: {
            mode: "search",
            route: "search"
          }
        };
      },
      readLawSourceDocumentFn: async () => createLatestDocument(),
      recommendLawSourcePairFn: () => null
    }
  );

  assert.equal(searchArgs?.query, "서울특별시 청년 기본 조례 안내문");
  assert.equal(result.ordinance.matched.id, "1840747");
  assert.equal(result.ordinance.matched.title, "서울특별시 청년 기본 조례");
  assert.equal(result.meta.search.route, "search");
  assert.deepEqual(result.meta.search.consideredRoutes, ["search", "discover"]);
});
