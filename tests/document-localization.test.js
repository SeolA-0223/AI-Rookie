import test from "node:test";
import assert from "node:assert/strict";
import { localizeDocumentInspection, localizeDocumentText } from "../backend/src/inspection/documentLocalization.js";

test("localizeDocumentText uses Gemini to translate uploaded text", async () => {
  const result = await localizeDocumentText(
    {
      documentText: "대전광역시 동구 청년 기본 조례 안내문입니다.",
      targetLocale: "en"
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
                        translatedDocumentText: "This is a guide to the Daejeon Dong-gu Youth Basic Ordinance."
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
  assert.equal(result.translatedDocumentText, "This is a guide to the Daejeon Dong-gu Youth Basic Ordinance.");
});

test("localizeDocumentInspection translates review content and download markdown", async () => {
  const inspectionResult = {
    detection: {
      ordinanceTitleQuery: "대전광역시 동구 청년 기본 조례",
      reasoning: "문서 제목과 본문에서 직접 확인했습니다."
    },
    ordinance: {
      matched: {
        id: "2118913",
        title: "대전광역시 동구 청년 기본 조례"
      }
    },
    review: {
      reasoning: "??議?吏?????議고빆怨??낅젰 臾몄꽌? 鍮꾧탳?섏뿀?듬땲??",
      summary: "최신 조례 기준으로 검토가 필요합니다.",
      riskLevel: "medium",
      issues: [
        {
          section: "지원 대상",
          severity: "high",
          problem: "연령 상한이 오래되었습니다.",
          ordinanceBasis: "제2조 34세 이하",
          suggestion: "34세 이하 기준으로 수정하세요."
        }
      ],
      checklist: ["연령 기준을 수정하세요."],
      revisedDraft: "지원 대상은 19세 이상 34세 이하 청년입니다."
    },
    download: {
      fileName: "daejeon-guide-revision.md",
      contentType: "text/markdown; charset=utf-8",
      content: "# 문서 검사 결과"
    }
  };

  const result = await localizeDocumentInspection(
    {
      inspectionResult,
      documentText: "지원 대상은 만 39세 이하입니다.",
      targetLocale: "en"
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
                        translatedDocumentText: "Eligible applicants are young people aged 39 or younger.",
                        detectionReasoning: "The ordinance title and body clearly point to the Dong-gu youth ordinance.",
                        reviewReasoning: "The review compares the uploaded age guidance against the latest age limit clause.",
                        summary: "The document should be revised to match the latest ordinance.",
                        issues: [
                          {
                            section: "Eligibility",
                            severity: "high",
                            problem: "The maximum age is outdated.",
                            ordinanceBasis: "Article 2 sets the upper limit at 34.",
                            suggestion: "Revise the text to state 34 or younger."
                          }
                        ],
                        checklist: ["Update the age guidance."],
                        revisedDraft: "Eligible applicants are young people aged 19 to 34.",
                        downloadMarkdown: "# Document Review Result"
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
  assert.equal(result.detection.reasoning, "The ordinance title and body clearly point to the Dong-gu youth ordinance.");
  assert.equal(result.review.reasoning, "The review compares the uploaded age guidance against the latest age limit clause.");
  assert.equal(result.review.summary, "The document should be revised to match the latest ordinance.");
  assert.equal(result.review.issues[0].section, "Eligibility");
  assert.equal(result.review.riskLevel, "medium");
  assert.equal(result.download.fileName, "daejeon-guide-revision-en.md");
  assert.equal(result.download.content, "# Document Review Result");
  assert.equal(result.translatedDocumentText, "Eligible applicants are young people aged 39 or younger.");
});
