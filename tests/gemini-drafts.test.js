import test from "node:test";
import assert from "node:assert/strict";
import {
  generateDrafts,
  generateDraftsWithConfiguredAI,
  getDraftGenerationStatus
} from "../backend/src/generation/generateDrafts.js";

const changes = [
  {
    id: "c1",
    changeType: "요건",
    title: "연령 기준",
    beforeText: "19세 이상 29세 이하",
    afterText: "19세 이상 34세 이하"
  }
];

const risks = [
  {
    changeId: "c1",
    risk: {
      level: "빨강",
      reason: "대상자 범위가 넓어집니다."
    }
  }
];

test("getDraftGenerationStatus reads GEMINI_API_KEI first", () => {
  const status = getDraftGenerationStatus({
    env: {
      GEMINI_API_KEI: "demo-key",
      GEMINI_MODEL: "gemini-test-model"
    }
  });

  assert.equal(status.provider, "gemini");
  assert.equal(status.enabled, true);
  assert.equal(status.model, "gemini-test-model");
  assert.equal(status.apiKeyEnvName, "GEMINI_API_KEI");
  assert.deepEqual(status.missingEnv, []);
});

test("generateDraftsWithConfiguredAI falls back to template drafts when API key is missing", async () => {
  const fallbackDrafts = generateDrafts(changes, risks);
  const result = await generateDraftsWithConfiguredAI(changes, risks, {
    env: {},
    fallbackDrafts
  });

  assert.deepEqual(result.drafts, fallbackDrafts);
  assert.equal(result.meta.provider, "template");
  assert.equal(result.meta.usedAI, false);
  assert.equal(result.meta.reason, "missing_api_key");
});

test("generateDraftsWithConfiguredAI parses Gemini JSON draft output", async () => {
  const result = await generateDraftsWithConfiguredAI(changes, risks, {
    env: {
      GEMINI_API_KEI: "demo-key",
      GEMINI_MODEL: "gemini-2.5-flash"
    },
    fetchImpl: async (url, options) => {
      assert.match(url, /gemini-2\.5-flash:generateContent$/);
      assert.equal(options.method, "POST");
      assert.equal(options.headers["x-goog-api-key"], "demo-key");

      return {
        ok: true,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        internalNoticeDraft: "내부 공지 초안",
                        citizenGuideDraft: "시민 안내문 초안",
                        faqDraft: "FAQ 초안",
                        comparisonTable: "| Type | Clause | Before | After |\n|---|---|---|---|\n| 요건 | 연령 기준 | 19-29 | 19-34 |"
                      })
                    }
                  ]
                }
              }
            ]
          };
        }
      };
    }
  });

  assert.equal(result.meta.provider, "gemini");
  assert.equal(result.meta.usedAI, true);
  assert.equal(result.drafts.internalNoticeDraft, "내부 공지 초안");
  assert.equal(result.drafts.citizenGuideDraft, "시민 안내문 초안");
  assert.equal(result.drafts.faqDraft, "FAQ 초안");
  assert.ok(result.drafts.comparisonTable.includes("| Type | Clause | Before | After |"));
});
