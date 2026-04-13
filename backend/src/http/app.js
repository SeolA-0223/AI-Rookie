import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAnalysisStore, detectRunSource, parseHistoryLimit } from "../persistence/analysisStore.js";
import { generateDraftsWithConfiguredAI, getDraftGenerationStatus } from "../generation/generateDrafts.js";
import { PipelineValidationError, runPipeline } from "../pipeline/runPipeline.js";
import {
  createLawSource,
  getLawSourceStatus,
  probeLawSource,
  recommendLawSourcePair,
  resolveLawSourceProvider,
  searchLawSource,
  SourceResolutionError
} from "../sources/lawSource.js";
import {
  getLocalFixtureDefaultCaseId,
  listLocalFixtureCases,
  readLocalFixtureCasePack,
  readSampleInternalDocs
} from "../sources/providers/localFixtureLawSource.js";

try {
  process.loadEnvFile();
} catch {
  // Allow CI and fresh clones to run without a local .env file.
}

const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_ANALYZE_FIELDS = new Set(["before", "after", "internalDocs", "source"]);
const analysisStore = createAnalysisStore();
const defaultLawSource = createLawSource();
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STATIC_ROOT_FILE = path.join(REPO_ROOT, "index.html");
const STATIC_FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const SAMPLE_BEFORE_FILE = fileURLToPath(new URL("../../../data/samples/regulation_before.json", import.meta.url));
const SAMPLE_AFTER_FILE = fileURLToPath(new URL("../../../data/samples/regulation_after.json", import.meta.url));
const SAMPLE_INTERNAL_DOCS_FILE = fileURLToPath(new URL("../../../data/samples/internal_docs.json", import.meta.url));
const ROUTES = {
  health: new Set(["/health", "/api/health"]),
  history: new Set(["/history", "/api/history"]),
  caseCatalog: new Set(["/case-catalog", "/api/case-catalog"]),
  sourceSearch: new Set(["/source-search", "/api/source-search"]),
  sourceStatus: new Set(["/source-status", "/api/source-status"]),
  analyze: new Set(["/analyze", "/api/analyze"])
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readSample(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function getRequestUrl(req) {
  return new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, contentType, payload) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(payload);
}

function sendError(res, statusCode, code, message, details = []) {
  sendJson(res, statusCode, {
    error: {
      code,
      message,
      details
    }
  });
}

function contentTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }
  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }
  if (extension === ".js") {
    return "application/javascript; charset=utf-8";
  }
  if (extension === ".json") {
    return "application/json; charset=utf-8";
  }
  return "application/octet-stream";
}

function tryReadStaticFile(pathname) {
  if (pathname === "/") {
    return STATIC_ROOT_FILE;
  }

  if (!pathname.startsWith("/frontend/")) {
    return null;
  }

  const relativePath = pathname.replace(/^\/+/, "");
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const normalizedRoot = `${STATIC_FRONTEND_ROOT}${path.sep}`;

  if (!absolutePath.startsWith(normalizedRoot)) {
    return null;
  }

  return absolutePath;
}

async function serveStaticIfMatched(req, res) {
  if (req.method !== "GET") {
    return false;
  }

  const pathname = getRequestUrl(req).pathname;
  const filePath = tryReadStaticFile(pathname);
  if (!filePath) {
    return false;
  }

  try {
    const body = await fs.promises.readFile(filePath);
    sendText(res, 200, contentTypeForPath(filePath), body);
    return true;
  } catch {
    return false;
  }
}

async function collectJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body must be 1MB or smaller.");
        error.code = "REQUEST_TOO_LARGE";
        reject(error);
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        const error = new Error("Request body must be valid JSON.");
        error.code = "INVALID_JSON";
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function validateAnalyzeRequest(payload) {
  const details = [];

  if (!isPlainObject(payload)) {
    return [{ path: "body", message: "must be a JSON object" }];
  }

  for (const key of Object.keys(payload)) {
    if (!ALLOWED_ANALYZE_FIELDS.has(key)) {
      details.push({ path: `body.${key}`, message: "is not allowed" });
    }
  }

  if ("before" in payload && !isPlainObject(payload.before)) {
    details.push({ path: "body.before", message: "must be an object" });
  }
  if ("after" in payload && !isPlainObject(payload.after)) {
    details.push({ path: "body.after", message: "must be an object" });
  }
  if ("internalDocs" in payload && !Array.isArray(payload.internalDocs)) {
    details.push({ path: "body.internalDocs", message: "must be an array" });
  }
  if ("source" in payload && !isPlainObject(payload.source)) {
    details.push({ path: "body.source", message: "must be an object" });
  }
  if (isPlainObject(payload.source) && "provider" in payload.source && typeof payload.source.provider !== "string") {
    details.push({ path: "body.source.provider", message: "must be a string" });
  }
  if (isPlainObject(payload.source) && "beforeId" in payload.source && typeof payload.source.beforeId !== "string") {
    details.push({ path: "body.source.beforeId", message: "must be a string" });
  }
  if (isPlainObject(payload.source) && "afterId" in payload.source && typeof payload.source.afterId !== "string") {
    details.push({ path: "body.source.afterId", message: "must be a string" });
  }
  if (isPlainObject(payload.source) && "caseId" in payload.source && typeof payload.source.caseId !== "string") {
    details.push({ path: "body.source.caseId", message: "must be a string" });
  }
  if ("source" in payload && ("before" in payload || "after" in payload)) {
    details.push({ path: "body.source", message: "cannot be combined with body.before or body.after" });
  }

  return details;
}

function parseSourceSearchLimit(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 10);
}

export async function buildAnalyzeInput(payload) {
  if (payload.source) {
    const requestedProvider = resolveLawSourceProvider({
      provider: payload.source.provider
    });

    if (requestedProvider === "local-fixture" && typeof payload.source.caseId === "string" && payload.source.caseId.trim()) {
      const casePack = readLocalFixtureCasePack(payload.source.caseId);
      return {
        beforeDoc: casePack.beforeDoc,
        afterDoc: casePack.afterDoc,
        internalDocs: payload.internalDocs ?? casePack.internalDocs,
        sourceMeta: {
          provider: "local-fixture",
          mode: "case-pack",
          caseId: casePack.caseId,
          caseTitle: casePack.catalogEntry.title,
          municipality: casePack.catalogEntry.municipality,
          officialUrl: casePack.catalogEntry.officialUrl
        }
      };
    }

    const requestedLawSource = createLawSource({
      provider: requestedProvider
    });
    const resolvedPair = await requestedLawSource.resolveRegulationPair(payload.source);
    return {
      beforeDoc: resolvedPair.beforeDoc,
      afterDoc: resolvedPair.afterDoc,
      internalDocs: payload.internalDocs ?? readSampleInternalDocs(),
      sourceMeta: resolvedPair.meta
    };
  }

  return {
    beforeDoc: payload.before ?? readSample(SAMPLE_BEFORE_FILE),
    afterDoc: payload.after ?? readSample(SAMPLE_AFTER_FILE),
    internalDocs: payload.internalDocs ?? readSample(SAMPLE_INTERNAL_DOCS_FILE),
    sourceMeta:
      "before" in payload || "after" in payload
        ? { provider: "inline", mode: "request" }
        : { provider: "local-fixture", mode: "sample" }
  };
}

export function buildCaseCatalogPayload() {
  return {
    provider: "local-fixture",
    defaultCaseId: getLocalFixtureDefaultCaseId(),
    cases: listLocalFixtureCases()
  };
}

function parseProbeFlag(value) {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "yes";
}

export async function buildSourceStatusPayload({ provider, probe = false } = {}) {
  const requestedProvider = resolveLawSourceProvider({ provider });
  const source = getLawSourceStatus({
    provider: requestedProvider
  });

  return {
    requestedProvider,
    source,
    probe: probe ? await probeLawSource({ provider: requestedProvider }) : null
  };
}

export async function buildSourceSearchPayload({ provider, query, limit } = {}) {
  const requestedProvider = resolveLawSourceProvider({ provider });
  const normalizedQuery = typeof query === "string" ? query.trim() : "";

  if (!normalizedQuery) {
    return {
      requestedProvider,
      query: "",
      results: [],
      recommendation: null,
      meta: {
        provider: requestedProvider,
        mode: "search"
      }
    };
  }

  const searchResult = await searchLawSource({
    provider: requestedProvider,
    query: normalizedQuery,
    limit
  });

  return {
    requestedProvider,
    query: normalizedQuery,
    results: Array.isArray(searchResult.results) ? searchResult.results : [],
    recommendation: recommendLawSourcePair(searchResult.results, normalizedQuery),
    meta: searchResult.meta ?? {
      provider: requestedProvider,
      mode: "search"
    }
  };
}

export async function handleHealth(req, res) {
  sendJson(res, 200, {
    status: "ok",
    service: "ai-rookie",
    ai: getDraftGenerationStatus(),
    storage: analysisStore.getStorageStatus(),
    source: defaultLawSource.getSourceStatus()
  });
}

export async function handleSourceStatus(req, res) {
  const requestUrl = getRequestUrl(req);
  sendJson(res, 200, await buildSourceStatusPayload({
    provider: requestUrl.searchParams.get("provider"),
    probe: parseProbeFlag(requestUrl.searchParams.get("probe"))
  }));
}

export async function handleCaseCatalog(_req, res) {
  sendJson(res, 200, buildCaseCatalogPayload());
}

export async function handleSourceSearch(req, res) {
  try {
    const requestUrl = getRequestUrl(req);
    const query = requestUrl.searchParams.get("query");

    if (typeof query !== "string" || query.trim() === "") {
      sendError(res, 400, "INVALID_REQUEST", "Source search request is invalid.", [
        {
          path: "query",
          message: "is required"
        }
      ]);
      return;
    }

    const payload = await buildSourceSearchPayload({
      provider: requestUrl.searchParams.get("provider"),
      query,
      limit: parseSourceSearchLimit(requestUrl.searchParams.get("limit"))
    });
    sendJson(res, 200, payload);
  } catch (error) {
    if (error instanceof SourceResolutionError) {
      sendError(res, error.statusCode, error.code, error.message, error.details);
      return;
    }

    sendError(res, 500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

export async function handleHistory(req, res) {
  const requestUrl = getRequestUrl(req);
  const limit = parseHistoryLimit(requestUrl.searchParams.get("limit"));
  const history = await analysisStore.listRecentRuns(limit);
  sendJson(res, 200, history);
}

export async function handleAnalyze(req, res) {
  try {
    const payload = await collectJson(req);
    const requestErrors = validateAnalyzeRequest(payload);
    if (requestErrors.length > 0) {
      sendError(res, 400, "INVALID_REQUEST", "Analyze request is invalid.", requestErrors);
      return;
    }

    const { beforeDoc, afterDoc, internalDocs, sourceMeta } = await buildAnalyzeInput(payload);
    const source = detectRunSource(payload);
    const result = runPipeline({ beforeDoc, afterDoc, internalDocs });
    const draftGeneration = await generateDraftsWithConfiguredAI(result.analysis.changes, result.analysis.risks, {
      fallbackDrafts: result.drafts
    });

    result.drafts = draftGeneration.drafts;
    result.meta.inputSource = sourceMeta;
    result.meta.ai = draftGeneration.meta;
    const persistence = await analysisStore.saveRun({
      source,
      requestPayload: {
        before: beforeDoc,
        after: afterDoc,
        internalDocs
      },
      result
    });

    result.meta.storage = {
      ...analysisStore.getStorageStatus(),
      saved: persistence.saved,
      runId: persistence.runId ?? null,
      reason: persistence.reason ?? null
    };
    if (persistence.message) {
      result.meta.storage.message = persistence.message;
    }

    sendJson(res, 200, result);
  } catch (error) {
    if (error?.code === "INVALID_JSON") {
      sendError(res, 400, "INVALID_JSON", error.message);
      return;
    }
    if (error?.code === "REQUEST_TOO_LARGE") {
      sendError(res, 413, "REQUEST_TOO_LARGE", error.message);
      return;
    }
    if (error instanceof PipelineValidationError) {
      sendError(res, 422, error.code, error.message, error.details);
      return;
    }
    if (error instanceof SourceResolutionError) {
      sendError(res, error.statusCode, error.code, error.message, error.details);
      return;
    }

    sendError(res, 500, "INTERNAL_ERROR", "Unexpected server error.");
  }
}

export async function routeRequest(req, res) {
  if (await serveStaticIfMatched(req, res)) {
    return;
  }

  const pathname = getRequestUrl(req).pathname;

  if (req.method === "GET" && ROUTES.health.has(pathname)) {
    await handleHealth(req, res);
    return;
  }

  if (req.method === "GET" && ROUTES.history.has(pathname)) {
    await handleHistory(req, res);
    return;
  }

  if (req.method === "GET" && ROUTES.caseCatalog.has(pathname)) {
    await handleCaseCatalog(req, res);
    return;
  }

  if (req.method === "GET" && ROUTES.sourceSearch.has(pathname)) {
    await handleSourceSearch(req, res);
    return;
  }

  if (req.method === "GET" && ROUTES.sourceStatus.has(pathname)) {
    await handleSourceStatus(req, res);
    return;
  }

  if (req.method === "POST" && ROUTES.analyze.has(pathname)) {
    await handleAnalyze(req, res);
    return;
  }

  sendError(res, 404, "NOT_FOUND", "Route not found.");
}
