import test from "node:test";
import assert from "node:assert/strict";

test("buildAnalyzeInput uses request source provider instead of default env provider", async (t) => {
  const previousProvider = process.env.LAW_SOURCE_PROVIDER;
  const previousBaseUrl = process.env.KOREA_LAW_MCP_BASE_URL;

  process.env.LAW_SOURCE_PROVIDER = "korea-law-mcp";
  process.env.KOREA_LAW_MCP_BASE_URL = "";

  t.after(() => {
    if (previousProvider === undefined) {
      delete process.env.LAW_SOURCE_PROVIDER;
    } else {
      process.env.LAW_SOURCE_PROVIDER = previousProvider;
    }

    if (previousBaseUrl === undefined) {
      delete process.env.KOREA_LAW_MCP_BASE_URL;
    } else {
      process.env.KOREA_LAW_MCP_BASE_URL = previousBaseUrl;
    }
  });

  const moduleUrl = new URL(`../backend/src/http/app.js?case=${Date.now()}`, import.meta.url);
  const { buildAnalyzeInput } = await import(moduleUrl);
  const input = await buildAnalyzeInput({
    source: {
      provider: "local-fixture"
    }
  });

  assert.equal(input.sourceMeta.provider, "local-fixture");
  assert.ok(Array.isArray(input.beforeDoc.clauses));
  assert.ok(Array.isArray(input.afterDoc.clauses));
});

test("buildAnalyzeInput loads bundled case packs for local-fixture caseId", async () => {
  const moduleUrl = new URL(`../backend/src/http/app.js?case=fixture-case-${Date.now()}`, import.meta.url);
  const { buildAnalyzeInput } = await import(moduleUrl);
  const input = await buildAnalyzeInput({
    source: {
      provider: "local-fixture",
      caseId: "seoul_youth_basic_ordinance"
    }
  });

  assert.equal(input.sourceMeta.provider, "local-fixture");
  assert.equal(input.sourceMeta.mode, "case-pack");
  assert.equal(input.sourceMeta.caseId, "seoul_youth_basic_ordinance");
  assert.equal(input.beforeDoc.title, "Seoul Youth Basic Ordinance");
  assert.equal(input.afterDoc.title, "Seoul Youth Basic Ordinance");
  assert.equal(input.internalDocs.length, 5);
});

test("buildSourceStatusPayload reports request-selected source provider status", async (t) => {
  const previousProvider = process.env.LAW_SOURCE_PROVIDER;
  const previousBaseUrl = process.env.KOREA_LAW_MCP_BASE_URL;

  process.env.LAW_SOURCE_PROVIDER = "local-fixture";
  process.env.KOREA_LAW_MCP_BASE_URL = "";

  t.after(() => {
    if (previousProvider === undefined) {
      delete process.env.LAW_SOURCE_PROVIDER;
    } else {
      process.env.LAW_SOURCE_PROVIDER = previousProvider;
    }

    if (previousBaseUrl === undefined) {
      delete process.env.KOREA_LAW_MCP_BASE_URL;
    } else {
      process.env.KOREA_LAW_MCP_BASE_URL = previousBaseUrl;
    }
  });

  const moduleUrl = new URL(`../backend/src/http/app.js?case=status-${Date.now()}`, import.meta.url);
  const { buildSourceStatusPayload } = await import(moduleUrl);
  const payload = await buildSourceStatusPayload({
    provider: "korea-law-mcp"
  });

  assert.equal(payload.requestedProvider, "korea-law-mcp");
  assert.equal(payload.source.provider, "korea-law-mcp");
  assert.equal(payload.source.enabled, false);
  assert.deepEqual(payload.source.missingEnv, ["KOREA_LAW_MCP_BASE_URL"]);
  assert.equal(payload.probe, null);
});

test("buildSourceSearchPayload returns empty local-fixture search results", async () => {
  const moduleUrl = new URL(`../backend/src/http/app.js?case=search-${Date.now()}`, import.meta.url);
  const { buildSourceSearchPayload } = await import(moduleUrl);
  const payload = await buildSourceSearchPayload({
    provider: "local-fixture",
    query: "sample"
  });

  assert.equal(payload.requestedProvider, "local-fixture");
  assert.equal(payload.query, "sample");
  assert.deepEqual(payload.results, []);
  assert.equal(payload.recommendation, null);
  assert.equal(payload.meta.provider, "local-fixture");
});

test("buildSourceSearchPayload uses interpreted municipalities and reranked multi-query search results", async () => {
  const moduleUrl = new URL(`../backend/src/http/app.js?case=search-ai-${Date.now()}`, import.meta.url);
  const { buildSourceSearchPayload } = await import(moduleUrl);
  const calls = [];
  const payload = await buildSourceSearchPayload(
    {
      provider: "law-go-public",
      query: "\uB300\uC804 \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840 \uCC3E\uC544\uC918",
      limit: 6,
      municipalities: []
    },
    {
      env: {},
      fetchImpl: undefined,
      interpretSourceSearchQueryFn: async () => ({
        searchQuery: "\uB300\uC804 \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840",
        keywords: ["\uCCAD\uB144", "\uAE30\uBCF8"],
        expandedQueries: ["\uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840"],
        municipalityCodes: ["6300000"],
        municipalityNames: ["\uB300\uC804\uAD11\uC5ED\uC2DC"],
        explicitMunicipalityCodes: ["6300000"],
        explicitMunicipalityNames: ["\uB300\uC804\uAD11\uC5ED\uC2DC"],
        reasoning: "interpreted",
        ai: {
          usedAI: true,
          provider: "gemini"
        }
      }),
      searchLawSourceFn: async ({ query, municipalities }) => {
        calls.push({ query, municipalities });
        if (query === "\uB300\uC804 \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840") {
          return {
            results: [
              {
                id: "best",
                title: "\uB300\uC804\uAD11\uC5ED\uC2DC \uCCAD\uB144 \uAE30\uBCF8 \uC870\uB840",
                jurisdiction: "\uB300\uC804\uAD11\uC5ED\uC2DC"
              },
              {
                id: "other",
                title: "\uCCAD\uB144 \uC9C0\uC6D0 \uC870\uB840",
                jurisdiction: "\uC11C\uC6B8\uD2B9\uBCC4\uC2DC"
              }
            ],
            meta: {
              provider: "law-go-public",
              mode: "search",
              municipalityCodes: ["6300000"],
              municipalityNames: ["\uB300\uC804\uAD11\uC5ED\uC2DC"]
            }
          };
        }

        return {
          results: [
            {
              id: "expanded",
              title: "\uB300\uC804\uAD11\uC5ED\uC2DC \uCCAD\uB144 \uC815\uCC45 \uC870\uB840",
              jurisdiction: "\uB300\uC804\uAD11\uC5ED\uC2DC"
            }
          ],
          meta: {
            provider: "law-go-public",
            mode: "search"
          }
        };
      },
      recommendLawSourcePairFn: (results) => ({
        before: results[1] ?? results[0],
        after: results[0],
        reason: "pair",
        confidence: 0.9
      })
    }
  );

  assert.ok(calls.length >= 2);
  calls.forEach((call) => assert.deepEqual(call.municipalities, ["6300000"]));
  assert.equal(payload.results[0].id, "best");
  assert.equal(payload.meta.aiSearch.usedAI, true);
  assert.deepEqual(payload.meta.aiSearch.explicitMunicipalityCodes, ["6300000"]);
  assert.ok(Array.isArray(payload.meta.searchQueries));
  assert.equal(payload.recommendation.after.id, "best");
});

test("buildCaseCatalogPayload exposes bundled local fixture cases", async () => {
  const moduleUrl = new URL(`../backend/src/http/app.js?case=catalog-${Date.now()}`, import.meta.url);
  const { buildCaseCatalogPayload } = await import(moduleUrl);
  const payload = buildCaseCatalogPayload();

  assert.equal(payload.provider, "local-fixture");
  assert.equal(payload.defaultCaseId, "ulsan_youth_job_support");
  assert.equal(payload.cases.length, 4);
  assert.ok(payload.cases.some((entry) => entry.caseId === "daejeon_youth_basic_ordinance"));
  assert.ok(payload.cases.some((entry) => entry.caseId === "seoul_youth_basic_ordinance"));
});
