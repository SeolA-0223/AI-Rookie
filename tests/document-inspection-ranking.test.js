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

test("document inspection keeps the top-ranked exact title match even when pair recommendation points to another ordinance", async () => {
  const cityMatch = {
    id: "2098227",
    title: "대전광역시 청년 기본 조례",
    jurisdiction: "대전광역시",
    promulgationDate: "2025-12-26",
    effectiveDate: "2025-12-26",
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2098227",
    current: false
  };
  const districtBeforeMatch = {
    id: "2046185",
    title: "대전광역시 대덕구 청년 기본 조례",
    jurisdiction: "대전광역시 대덕구",
    promulgationDate: "2025-06-27",
    effectiveDate: "2025-07-01",
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2046185",
    current: false
  };
  const districtAfterMatch = {
    id: "2121017",
    title: "대전광역시 대덕구 청년 기본 조례",
    jurisdiction: "대전광역시 대덕구",
    promulgationDate: "2026-04-10",
    effectiveDate: "2026-04-10",
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2121017",
    current: true
  };

  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "# 대전광역시 청년 기본 조례 운영 안내문\n\n대전광역시 청년 기본 조례상 청년은 만 19세 이상 34세 이하인 사람으로 본다.",
      fileName: "daejeon-youth-guide.md",
      municipalities: ["6300000"]
    },
    {
      env: {},
      discoverLawSourceFn: async () => ({
        results: [],
        meta: {
          mode: "discover",
          route: "discover"
        }
      }),
      searchLawSourceFn: async () => ({
        results: [cityMatch, districtAfterMatch, districtBeforeMatch],
        meta: {
          mode: "search",
          route: "search"
        }
      }),
      readLawSourceDocumentFn: async ({ id }) => ({
        document: {
          title: id === cityMatch.id ? cityMatch.title : districtAfterMatch.title,
          version: "최신본",
          clauses: [
            {
              id: "c1",
              title: "청년 정의",
              text: "청년은 만 19세 이상 34세 이하인 사람으로 본다."
            }
          ]
        },
        meta: {
          id,
          referenceUrl: `https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=${id}`
        }
      }),
      recommendLawSourcePairFn: () => ({
        before: {
          id: districtBeforeMatch.id,
          title: districtBeforeMatch.title,
          jurisdiction: districtBeforeMatch.jurisdiction,
          effectiveDate: districtBeforeMatch.effectiveDate,
          promulgationDate: districtBeforeMatch.promulgationDate
        },
        after: {
          id: districtAfterMatch.id,
          title: districtAfterMatch.title,
          jurisdiction: districtAfterMatch.jurisdiction,
          effectiveDate: districtAfterMatch.effectiveDate,
          promulgationDate: districtAfterMatch.promulgationDate
        },
        confidence: "high",
        matchCount: 2,
        reason: "Matched the district ordinance pair.",
        strategy: "timeline-heuristic"
      })
    }
  );

  assert.equal(result.ordinance.matched.id, cityMatch.id);
  assert.equal(result.ordinance.matched.title, cityMatch.title);
  assert.equal(result.meta.search.route, "search");
  assert.equal(result.ordinance.candidates[0].id, cityMatch.id);
});

test("document inspection retries a cleaned ordinance query when the raw guide title search fails", async () => {
  const searchQueries = [];
  const cityMatch = {
    id: "2098227",
    title: "대전광역시 청년 기본 조례",
    jurisdiction: "대전광역시",
    promulgationDate: "2025-12-26",
    effectiveDate: "2025-12-26",
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2098227",
    current: false
  };

  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "# 대전광역시 청년 기본 조례 운영 안내문\n\n대전광역시 청년 기본 조례상 청년은 만 19세 이상 34세 이하인 사람으로 본다.",
      fileName: "daejeon-youth-guide.md",
      municipalities: ["6300000"]
    },
    {
      env: {},
      discoverLawSourceFn: async () => ({
        results: [],
        meta: {
          mode: "discover",
          route: "discover"
        }
      }),
      searchLawSourceFn: async (input) => {
        searchQueries.push(input.query);
        if (searchQueries.length === 1) {
          throw new Error("first search query failed");
        }

        return {
          results: [cityMatch],
          meta: {
            mode: "search",
            route: "search"
          }
        };
      },
      readLawSourceDocumentFn: async () => ({
        document: {
          title: cityMatch.title,
          version: "최신본",
          clauses: [
            {
              id: "c1",
              title: "청년 정의",
              text: "청년은 만 19세 이상 34세 이하인 사람으로 본다."
            }
          ]
        },
        meta: {
          id: cityMatch.id,
          referenceUrl: cityMatch.referenceUrl
        }
      }),
      recommendLawSourcePairFn: () => null
    }
  );

  assert.ok(searchQueries.length >= 2);
  assert.notEqual(searchQueries[1], searchQueries[0]);
  assert.equal(result.ordinance.matched.id, cityMatch.id);
  assert.equal(result.meta.search.route, "search");
});
