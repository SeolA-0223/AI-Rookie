import test from "node:test";
import assert from "node:assert/strict";
import {
  interpretSourceSearchQuery,
  rankInterpretedSearchResults
} from "../backend/src/search/interpretSourceSearchQuery.js";

test("interpretSourceSearchQuery extracts explicit municipality hints without Gemini", async () => {
  const result = await interpretSourceSearchQuery(
    {
      query: "\uB300\uC804 \uCCAD\uB144 \uC9C0\uC6D0 \uAD00\uB828 \uC870\uB840 \uCC3E\uC544\uC918",
      municipalities: []
    },
    {
      env: {},
      fetchImpl: undefined
    }
  );

  assert.equal(result.ai.usedAI, false);
  assert.deepEqual(result.explicitMunicipalityCodes, ["6300000"]);
  assert.ok(result.keywords.includes("\uCCAD\uB144"));
  assert.ok(result.searchQuery.includes("\uCCAD\uB144"));
});

test("interpretSourceSearchQuery merges Gemini hints with heuristic query interpretation", async () => {
  const result = await interpretSourceSearchQuery(
    {
      query: "\uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840 \uC11C\uC6B8 \uCD5C\uC2E0 \uBC84\uC804",
      municipalities: []
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
                        searchQuery: "\uC11C\uC6B8 \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840",
                        municipalityHints: ["\uC11C\uC6B8\uD2B9\uBCC4\uC2DC"],
                        keywords: ["\uCCAD\uB144", "\uAE30\uBCF8"],
                        expandedQueries: [
                          "\uC11C\uC6B8 \uCCAD\uB144 \uC815\uCC45 \uC870\uB840"
                        ],
                        reasoning: "query narrowed to Seoul youth ordinance"
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

  assert.equal(result.ai.usedAI, true);
  assert.equal(result.searchQuery, "\uC11C\uC6B8 \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840");
  assert.ok(result.municipalityCodes.includes("6110000"));
  assert.ok(result.expandedQueries.includes("\uC11C\uC6B8 \uCCAD\uB144 \uC815\uCC45 \uC870\uB840"));
});

test("rankInterpretedSearchResults boosts municipality and keyword matches", () => {
  const ranked = rankInterpretedSearchResults({
    interpretation: {
      searchQuery: "\uB300\uC804 \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840",
      expandedQueries: ["\uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840"],
      municipalityNames: ["\uB300\uC804\uAD11\uC5ED\uC2DC"],
      keywords: ["\uCCAD\uB144", "\uAE30\uBCF8"]
    },
    searchBatches: [
      {
        query: "\uB300\uC804 \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840",
        results: [
          {
            id: "wrong",
            title: "\uCCAD\uB144 \uC9C0\uC6D0 \uC870\uB840",
            jurisdiction: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC"
          },
          {
            id: "best",
            title: "\uB300\uC804\uAD11\uC5ED\uC2DC \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840",
            jurisdiction: "\uB300\uC804\uAD11\uC5ED\uC2DC"
          }
        ]
      }
    ],
    limit: 2
  });

  assert.equal(ranked[0].id, "best");
});
