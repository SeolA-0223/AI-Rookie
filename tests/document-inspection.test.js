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
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=1840747"
  };
}

function createLatestDocument() {
  return {
    document: {
      title: "서울특별시 청년 기본 조례",
      version: "서울특별시 조례 제9999호",
      clauses: [
        {
          id: "c1",
          title: "제4조 지원대상",
          text: "지원대상은 19세 이상 34세 이하 청년으로 한다."
        },
        {
          id: "c2",
          title: "제8조 신청서류",
          text: "신청 시 주민등록초본과 신청서를 제출한다."
        }
      ]
    },
    meta: {
      id: "1840747",
      referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=1840747"
    }
  };
}

test("inspectDocumentAgainstLatestOrdinance falls back without Gemini and returns a downloadable revision", async () => {
  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "서울특별시 청년 기본 조례 안내문\n지원대상은 19세 이상 29세 이하로 안내합니다.",
      fileName: "youth-guide.txt",
      municipalities: ["6110000"]
    },
    {
      env: {},
      discoverLawSourceFn: async () => ({
        results: [createLatestMatch()],
        meta: {
          mode: "discover",
          route: "discover"
        }
      }),
      readLawSourceDocumentFn: async () => createLatestDocument(),
      searchLawSourceFn: async () => ({ results: [], meta: {} }),
      recommendLawSourcePairFn: () => null,
      now: () => "2026-04-14T00:00:00.000Z"
    }
  );

  assert.equal(result.meta.generatedAt, "2026-04-14T00:00:00.000Z");
  assert.equal(result.detection.municipalityNames[0], "서울특별시");
  assert.equal(result.ordinance.matched.id, "1840747");
  assert.ok(result.review.summary.length > 0);
  assert.ok(result.review.reasoning);
  assert.notEqual(result.review.reasoning, result.detection.reasoning);
  assert.ok(result.review.issues.length >= 1);
  assert.equal(result.download.fileName, "youth-guide.txt-revision.md");
  assert.ok(result.download.content.includes("문서 검사 결과"));
});

test("inspectDocumentAgainstLatestOrdinance preserves municipality filters when it falls back to source search", async () => {
  let searchArgs = null;

  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "?쒖슱?밸퀎??泥?뀈 湲곕낯 議곕? ?덈궡臾?n吏?먮??곸? 19???댁긽 29???댄븯濡??덈궡?⑸땲??",
      fileName: "search-fallback.txt",
      municipalities: ["6110000"]
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
        searchArgs = input;
        return {
          results: [createLatestMatch()],
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

  assert.deepEqual(searchArgs?.municipalities, ["6110000"]);
  assert.equal(result.ordinance.matched.id, "1840747");
});

test("inspectDocumentAgainstLatestOrdinance keeps the explicit ordinance title when AI suggests an unrelated title", async () => {
  let discoverArgs = null;
  const responses = [
    {
      ordinanceTitleQuery: "대전광역시 대덕구 관급공사의 지역건설근로자 체불임금 방지 및 고용안정 보호에 관한 조례",
      municipalityHints: ["대전광역시"],
      keywords: ["대전광역시", "대덕구", "관급공사"],
      reasoning: "AI first-pass detection drifted to another Daejeon ordinance.",
      confidence: "high",
      documentType: "guide"
    },
    {
      summary: "문서는 청년 조례 기준으로 다시 확인해야 합니다.",
      reasoning: "문서 제목과 조항 키워드를 기준으로 청년 조례를 비교했습니다.",
      riskLevel: "medium",
      issues: [],
      checklist: [],
      revisedDraft: "개정 초안"
    }
  ];

  await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "대전광역시 동구 청년 기본 조례 안내문\n지원 대상은 만 19세 이상 39세 이하 청년입니다.",
      fileName: "daejeon-donggu-youth-basic-guide.md",
      municipalities: ["6300000"]
    },
    {
      env: {
        GEMINI_API_KEI: "demo-key",
        GEMINI_MODEL: "gemini-2.5-flash"
      },
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify(responses.shift())
                    }
                  ]
                }
              }
            ]
          };
        }
      }),
      discoverLawSourceFn: async (input) => {
        discoverArgs = input;
        return {
          results: [createLatestMatch()],
          meta: {
            mode: "discover",
            route: "discover"
          }
        };
      },
      readLawSourceDocumentFn: async () => createLatestDocument(),
      searchLawSourceFn: async () => ({ results: [], meta: {} }),
      recommendLawSourcePairFn: () => null
    }
  );

  assert.equal(discoverArgs?.query, "대전광역시 동구 청년 기본 조례 안내문");
});

test("inspectDocumentAgainstLatestOrdinance uses Gemini output when configured", async () => {
  const responses = [
    {
      ordinanceTitleQuery: "서울특별시 청년 기본 조례",
      municipalityHints: ["서울특별시"],
      keywords: ["청년", "기본", "조례"],
      reasoning: "문서 제목과 본문에서 직접 확인됨",
      confidence: "high",
      documentType: "guide"
    },
    {
      summary: "문서의 연령 기준이 최신 조례와 다릅니다.",
      reasoning: "泥?뀈 ?곕졊 湲곗??낅젰 臾몄꽌? 理쒖떊 議곕? ??2 議곕?鍮꾧탳?ㅼ뒿?덈떎.",
      riskLevel: "high",
      issues: [
        {
          section: "지원대상",
          severity: "high",
          problem: "29세 이하로 적혀 있어 최신 기준보다 좁습니다.",
          ordinanceBasis: "제4조 지원대상: 19세 이상 34세 이하",
          suggestion: "34세 이하로 수정하고 관련 예시를 갱신하세요."
        }
      ],
      checklist: ["지원대상 연령 기준 수정", "FAQ 예시 나이 범위 수정"],
      revisedDraft: "지원대상은 19세 이상 34세 이하 청년입니다."
    }
  ];

  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "서울특별시 청년 기본 조례 안내문\n지원대상은 19세 이상 29세 이하로 안내합니다.",
      fileName: "guide.md",
      municipalities: ["6110000"]
    },
    {
      env: {
        GEMINI_API_KEI: "demo-key",
        GEMINI_MODEL: "gemini-2.5-flash"
      },
      fetchImpl: async () => ({
        ok: true,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify(responses.shift())
                    }
                  ]
                }
              }
            ]
          };
        }
      }),
      discoverLawSourceFn: async () => ({
        results: [createLatestMatch()],
        meta: {
          mode: "discover",
          route: "discover"
        }
      }),
      readLawSourceDocumentFn: async () => createLatestDocument(),
      searchLawSourceFn: async () => ({ results: [], meta: {} }),
      recommendLawSourcePairFn: () => null
    }
  );

  assert.equal(result.meta.detectionAi.provider, "gemini");
  assert.equal(result.meta.reviewAi.usedAI, true);
  assert.equal(result.detection.confidence, "high");
  assert.equal(result.review.riskLevel, "high");
  assert.equal(result.review.reasoning, "泥?뀈 ?곕졊 湲곗??낅젰 臾몄꽌? 理쒖떊 議곕? ??2 議곕?鍮꾧탳?ㅼ뒿?덈떎.");
  assert.equal(result.review.issues[0].section, "지원대상");
  assert.ok(result.review.revisedDraft.includes("34세 이하"));
});
