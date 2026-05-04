import test from "node:test";
import assert from "node:assert/strict";
import { inspectDocumentAgainstLatestOrdinance } from "../backend/src/inspection/inspectDocumentAgainstLatestOrdinance.js";

function createLatestMatch() {
  return {
    id: "2118913",
    title: "Daejeon Dong-gu Youth Basic Ordinance",
    jurisdiction: "Daejeon Dong-gu",
    promulgationDate: "2026-04-10",
    effectiveDate: "2026-04-10",
    referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2118913"
  };
}

function createLatestDocument() {
  return {
    document: {
      title: "Daejeon Dong-gu Youth Basic Ordinance",
      version: "Ordinance No. 9999",
      clauses: [
        {
          id: "c1",
          title: "Age eligibility",
          text: "Youth means a resident aged 19 to 39."
        },
        {
          id: "c2",
          title: "Application documents",
          text: "Applicants must submit proof of residence and an application form."
        }
      ]
    },
    meta: {
      id: "2118913",
      referenceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2118913"
    }
  };
}

test("inspectDocumentAgainstLatestOrdinance reads image media with Gemini before comparing against the latest ordinance", async () => {
  const responses = [
    {
      extractedDocumentText:
        "Daejeon Dong-gu Youth Basic Ordinance Notice\nApplicants aged 19 to 34 may apply for youth support.",
      apparentTitle: "Youth Support Notice",
      cleanedSummary: "A youth support notice for Daejeon Dong-gu residents.",
      documentType: "poster",
      ordinanceKeywords: ["Daejeon Dong-gu Youth Basic Ordinance", "youth support"],
      municipalityMentions: ["Daejeon Dong-gu"],
      reasoning: "Read the notice image and reconstructed the poster text."
    },
    {
      ordinanceTitleQuery: "Daejeon Dong-gu Youth Basic Ordinance",
      municipalityHints: ["Daejeon Dong-gu"],
      keywords: ["youth", "basic ordinance", "support"],
      reasoning: "The extracted title and body both point to the Daejeon Dong-gu youth ordinance.",
      confidence: "high",
      documentType: "notice"
    },
    {
      searchQuery: "Daejeon Dong-gu Youth Basic Ordinance",
      municipalityHints: ["Daejeon Dong-gu"],
      keywords: ["youth", "basic ordinance", "support"],
      expandedQueries: ["Daejeon youth basic ordinance", "Youth basic ordinance"],
      reasoning: "Search interpretation kept the detected ordinance title."
    },
    {
      summary: "The uploaded notice mostly matches the latest ordinance, but the review flow still produced a revision draft.",
      reasoning: "Compared the extracted age rule and support context against the latest ordinance clauses.",
      riskLevel: "medium",
      issues: [
        {
          section: "Eligibility",
          severity: "medium",
          problem: "The notice should keep the latest age language and supporting context aligned with the ordinance.",
          ordinanceBasis: "Clause 1 defines youth as residents aged 19 to 39.",
          suggestion: "Update the notice wording to track the latest ordinance clause text."
        }
      ],
      checklist: ["Review the age clause", "Confirm the listed application documents"],
      revisedDraft: "Applicants aged 19 to 39 who reside in Daejeon Dong-gu may apply for youth support."
    }
  ];

  const geminiBodies = [];
  let discoverArgs = null;

  const result = await inspectDocumentAgainstLatestOrdinance(
    {
      documentText: "",
      documentMedia: {
        mimeType: "image/png",
        data: "ZmFrZS1pbWFnZS1ieXRlcw==",
        originalFileName: "notice.png"
      },
      fileName: "notice.png",
      municipalities: ["6300000"]
    },
    {
      env: {
        GEMINI_API_KEI: "demo-key",
        GEMINI_MODEL: "gemini-2.5-flash"
      },
      fetchImpl: async (_url, init) => {
        geminiBodies.push(JSON.parse(init.body));
        return {
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
        };
      },
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
      recommendLawSourcePairFn: () => null,
      now: () => "2026-04-16T00:00:00.000Z"
    }
  );

  assert.equal(result.meta.generatedAt, "2026-04-16T00:00:00.000Z");
  assert.equal(result.meta.inputKind, "image");
  assert.equal(result.meta.mediaExtractionAi?.usedAI, true);
  assert.equal(result.input.kind, "image");
  assert.equal(result.input.mimeType, "image/png");
  assert.match(result.input.documentText, /Applicants aged 19 to 34/);
  assert.equal(result.input.extractedTitle, "Youth Support Notice");
  assert.match(result.detection.ordinanceTitleQuery, /Daejeon Dong-gu Youth Basic Ordinance/);
  assert.equal(result.ordinance.matched.id, "2118913");
  assert.ok(result.review.issues.length >= 1);
  assert.equal(result.download.fileName, "notice.png-revision.md");
  assert.deepEqual(discoverArgs?.municipalities, ["6300000"]);
  assert.equal(geminiBodies.length, 4);
  assert.equal(geminiBodies[0]?.contents?.[0]?.parts?.[1]?.inline_data?.mime_type, "image/png");
});
