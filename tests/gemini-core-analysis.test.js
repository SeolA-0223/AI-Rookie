import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runPipeline } from "../backend/src/pipeline/runPipeline.js";
import { enhancePipelineResultWithConfiguredAI } from "../backend/src/pipeline/enhancePipelineWithGemini.js";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const beforeDoc = readJson("data/samples/regulation_before.json");
const afterDoc = readJson("data/samples/regulation_after.json");
const internalDocs = readJson("data/samples/internal_docs.json");

test("enhancePipelineResultWithConfiguredAI falls back cleanly when Gemini is unavailable", async () => {
  const baseline = runPipeline({ beforeDoc, afterDoc, internalDocs });
  const enhanced = await enhancePipelineResultWithConfiguredAI(
    {
      beforeDoc,
      afterDoc,
      internalDocs,
      result: baseline
    },
    {
      env: {},
      fetchImpl: undefined
    }
  );

  assert.deepEqual(enhanced.result.analysis.changes, baseline.analysis.changes);
  assert.equal(enhanced.meta.usedAI, false);
  assert.equal(enhanced.meta.applied, false);
});

test("enhancePipelineResultWithConfiguredAI merges Gemini change, impact, and risk overrides", async () => {
  const baseline = runPipeline({ beforeDoc, afterDoc, internalDocs });
  const enhanced = await enhancePipelineResultWithConfiguredAI(
    {
      beforeDoc,
      afterDoc,
      internalDocs,
      result: baseline
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
                        changes: [
                          {
                            id: "c1",
                            changeType: "\uC694\uAC74",
                            summary: "\uCCAD\uB144 \uB300\uC0C1 \uC5F0\uB839 \uBC0F \uC9C1\uC5C5 \uBC94\uC704\uAC00 \uD655\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4."
                          }
                        ],
                        impactedDocuments: [
                          {
                            changeId: "c1",
                            impactedDocuments: [
                              {
                                documentId: "d1",
                                score: 0.92,
                                reason: "\uB300\uBBFC \uC548\uB0B4 \uBB38\uC11C\uC5D0 \uC790\uACA9 \uBC94\uC704\uAC00 \uB4E4\uC5B4\uAC11\uB2C8\uB2E4."
                              },
                              {
                                documentId: "d2",
                                score: 0.81,
                                reason: "FAQ answers must reflect new eligibility guidance."
                              }
                            ]
                          }
                        ],
                        risks: [
                          {
                            changeId: "c1",
                            risk: {
                              level: "\uBE68\uAC15",
                              reason: "\uC790\uACA9 \uC548\uB0B4\uBB38\uC5D0 \uBC14\uB85C \uBC18\uC601\uB418\uC9C0 \uC54A\uC73C\uBA74 \uB300\uBBFC \uC624\uC548\uB0B4 \uAC00\uB2A5\uC131\uC774 \uD07D\uB2C8\uB2E4."
                            }
                          }
                        ]
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

  assert.equal(enhanced.meta.usedAI, true);
  assert.equal(enhanced.meta.applied, true);
  assert.ok(enhanced.meta.overriddenChangeCount >= 1);

  const c1 = enhanced.result.analysis.changes.find((change) => change.id === "c1");
  const c1Impact = enhanced.result.analysis.impactedDocuments.find((item) => item.changeId === "c1");
  const c1Risk = enhanced.result.analysis.risks.find((item) => item.changeId === "c1");

  assert.equal(c1.changeType, "\uC694\uAC74");
  assert.match(c1.summary, /\uC5F0\uB839/);
  assert.deepEqual(c1Impact.impactedDocuments.map((item) => item.documentId), ["d1", "d2"]);
  assert.equal(c1Risk.risk.level, "\uBE68\uAC15");
});
