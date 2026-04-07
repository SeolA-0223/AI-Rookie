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
