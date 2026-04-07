const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
const SMOKE_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 5000);

async function fetchJson(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SMOKE_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal
    });
    const bodyText = await response.text();
    const json = bodyText ? JSON.parse(bodyText) : {};

    if (!response.ok) {
      throw new Error(`${path} failed with ${response.status}: ${bodyText}`);
    }

    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeAnalyzeResponse(body) {
  const analysis = body.analysis ?? {};
  return {
    changes: analysis.changes ?? body.changes ?? [],
    mapped: analysis.impactedDocuments ?? body.mapped ?? [],
    risks: analysis.risks ?? body.risks ?? [],
    traces: analysis.traces ?? body.traces ?? [],
    drafts: body.drafts ?? {}
  };
}

function validateAnalyzeResponse(body) {
  const normalized = normalizeAnalyzeResponse(body);
  assert(Array.isArray(normalized.changes), "Missing changes[] in /analyze response.");
  assert(Array.isArray(normalized.mapped), "Missing mapped[] in /analyze response.");
  assert(Array.isArray(normalized.risks), "Missing risks[] in /analyze response.");
  assert(Array.isArray(normalized.traces), "Missing traces[] in /analyze response.");
  assert(typeof normalized.drafts === "object" && normalized.drafts !== null, "Missing drafts object in /analyze response.");
  assert(typeof body.meta?.inputSource === "object" && body.meta.inputSource !== null, "Missing meta.inputSource in /analyze response.");
  return normalized;
}

async function main() {
  console.log(`Smoke target: ${BASE_URL}`);

  const health = await fetchJson("/health");
  assert(health.status === "ok", "Unexpected /health status value.");
  assert(typeof health.storage === "object" && health.storage !== null, "Missing storage object in /health response.");
  assert(typeof health.source === "object" && health.source !== null, "Missing source object in /health response.");
  console.log("Health endpoint check passed.");

  const sourceStatus = await fetchJson("/source-status?provider=korea-law-mcp");
  assert(sourceStatus.requestedProvider === "korea-law-mcp", "Unexpected requestedProvider in /source-status response.");
  assert(typeof sourceStatus.source === "object" && sourceStatus.source !== null, "Missing source object in /source-status response.");
  console.log(`Source status endpoint check passed. Provider ${sourceStatus.source.provider} enabled=${sourceStatus.source.enabled}.`);

  const analyze = await fetchJson("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: {
        provider: "local-fixture"
      }
    })
  });
  const normalized = validateAnalyzeResponse(analyze);
  assert(analyze.meta?.inputSource?.provider === "local-fixture", "Expected /analyze to report local-fixture input source.");
  console.log(`Analyze endpoint check passed. Source ${analyze.meta.inputSource.provider} detected ${normalized.changes.length} changes.`);

  const history = await fetchJson("/history");
  assert(Array.isArray(history.runs), "Missing runs[] in /history response.");
  assert(typeof history.storage === "object" && history.storage !== null, "Missing storage object in /history response.");
  console.log(`History endpoint check passed. Loaded ${history.runs.length} saved run(s).`);

  console.log("Smoke check passed.");
}

main().catch((error) => {
  console.error(`Smoke check failed: ${error.message}`);
  process.exit(1);
});
