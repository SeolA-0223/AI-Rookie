import test from "node:test";
import assert from "node:assert/strict";
import {
  createLawSource,
  resolveLawSourceProvider,
  SourceResolutionError
} from "../backend/src/sources/lawSource.js";

test("resolveLawSourceProvider defaults to local-fixture", () => {
  assert.equal(resolveLawSourceProvider({ provider: "" }), "local-fixture");
});

test("createLawSource returns local fixture source by default", async () => {
  const source = createLawSource({ provider: "local-fixture" });
  const status = source.getSourceStatus();
  const pair = await source.resolveRegulationPair({});

  assert.equal(status.provider, "local-fixture");
  assert.equal(status.enabled, true);
  assert.equal(pair.meta.provider, "local-fixture");
  assert.ok(Array.isArray(pair.beforeDoc.clauses));
  assert.ok(Array.isArray(pair.afterDoc.clauses));
});

test("createLawSource reports missing env for korea-law-mcp", async () => {
  const source = createLawSource({
    provider: "korea-law-mcp",
    koreaLawMcpBaseUrl: ""
  });
  const status = source.getSourceStatus();

  assert.equal(status.provider, "korea-law-mcp");
  assert.equal(status.enabled, false);
  assert.deepEqual(status.missingEnv, ["KOREA_LAW_MCP_BASE_URL"]);

  await assert.rejects(() => source.resolveRegulationPair({}), (error) => {
    assert.ok(error instanceof SourceResolutionError);
    assert.equal(error.code, "SOURCE_PROVIDER_MISCONFIGURED");
    return true;
  });
});

test("createLawSource preserves future korea-law-mcp adapter slot", async () => {
  const source = createLawSource({
    provider: "korea-law-mcp",
    koreaLawMcpBaseUrl: "http://127.0.0.1:8080"
  });

  await assert.rejects(() => source.resolveRegulationPair({}), (error) => {
    assert.ok(error instanceof SourceResolutionError);
    assert.equal(error.code, "SOURCE_PROVIDER_NOT_IMPLEMENTED");
    return true;
  });
});

test("createLawSource rejects unsupported providers", async () => {
  const source = createLawSource({ provider: "unknown-source" });
  const status = source.getSourceStatus();

  assert.equal(status.provider, "unsupported");
  assert.equal(status.enabled, false);

  await assert.rejects(() => source.resolveRegulationPair({}), (error) => {
    assert.ok(error instanceof SourceResolutionError);
    assert.equal(error.code, "SOURCE_PROVIDER_UNSUPPORTED");
    return true;
  });
});
