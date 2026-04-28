import test from "node:test";
import assert from "node:assert/strict";
import { localizeSourcePayload } from "../backend/src/localization/sourceLocalization.js";

test("localizeSourcePayload translates ordinance search results with Gemini", async () => {
  const result = await localizeSourcePayload(
    {
      mode: "search-results",
      targetLocale: "en",
      results: [
        {
          id: "1840747",
          title: "서울특별시 청년 기본 조례",
          jurisdiction: "서울특별시",
          summary: "청년 정책의 기본 방향을 정한 조례입니다.",
          effectiveDate: "2026-04-01",
          promulgationDate: "2026-04-01",
          referenceUrl: "https://law.go.kr/example",
          current: true
        }
      ],
      recommendation: {
        before: {
          id: "1840000",
          title: "서울특별시 청년 기본 조례",
          jurisdiction: "서울특별시",
          effectiveDate: "2025-01-01",
          promulgationDate: "2025-01-01",
          referenceUrl: "https://law.go.kr/before",
          current: false
        },
        after: {
          id: "1840747",
          title: "서울특별시 청년 기본 조례",
          jurisdiction: "서울특별시",
          effectiveDate: "2026-04-01",
          promulgationDate: "2026-04-01",
          referenceUrl: "https://law.go.kr/example",
          current: true
        },
        reason: "최신 공포본과 직전 시행본을 연결했습니다."
      }
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
                      text: JSON.stringify({
                        results: [
                          {
                            id: "1840747",
                            title: "Seoul Youth Basic Ordinance",
                            jurisdiction: "Seoul Metropolitan City",
                            summary: "This ordinance sets the basic direction for youth policy.",
                            effectiveDate: "2026-04-01",
                            promulgationDate: "2026-04-01",
                            referenceUrl: "https://law.go.kr/example",
                            current: true
                          }
                        ],
                        recommendationReason: "This pair links the latest promulgated version to the immediately previous enforceable version."
                      })
                    }
                  ]
                }
              }
            ]
          };
        }
      })
    }
  );

  assert.equal(result.locale, "en");
  assert.equal(result.ai.provider, "gemini");
  assert.equal(result.results[0].title, "Seoul Youth Basic Ordinance");
  assert.equal(result.results[0].jurisdiction, "Seoul Metropolitan City");
  assert.equal(result.results[0].effectiveDate, "2026-04-01");
  assert.equal(result.recommendation.after.id, "1840747");
  assert.equal(
    result.recommendation.reason,
    "This pair links the latest promulgated version to the immediately previous enforceable version."
  );
});

test("localizeSourcePayload falls back to the raw payload when translation is unavailable", async () => {
  const result = await localizeSourcePayload({
    mode: "discover-results",
    targetLocale: "en",
    results: [
      {
        id: "2118913",
        title: "대전광역시 동구 청년 기본 조례",
        jurisdiction: "대전광역시 동구",
        summary: "청년 정책 기본 조례",
        effectiveDate: "2026-04-10",
        promulgationDate: "2026-04-10",
        referenceUrl: "https://law.go.kr/daejeon",
        current: true
      }
    ]
  });

  assert.equal(result.locale, "en");
  assert.equal(result.ai.usedAI, false);
  assert.equal(result.results[0].title, "대전광역시 동구 청년 기본 조례");
  assert.equal(result.results[0].summary, "청년 정책 기본 조례");
});
