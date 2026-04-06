import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAnalysisStore, detectRunSource, parseHistoryLimit } from "../persistence/analysisStore.js";
import { PipelineValidationError, runPipeline } from "../pipeline/runPipeline.js";

try {
  process.loadEnvFile();
} catch {
  // Allow CI and fresh clones to run without a local .env file.
}

const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_ANALYZE_FIELDS = new Set(["before", "after", "internalDocs"]);
const analysisStore = createAnalysisStore();
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const STATIC_ROOT_FILE = path.join(REPO_ROOT, "index.html");
const STATIC_FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const SAMPLE_BEFORE_FILE = fileURLToPath(new URL("../../../data/samples/regulation_before.json", import.meta.url));
const SAMPLE_AFTER_FILE = fileURLToPath(new URL("../../../data/samples/regulation_after.json", import.meta.url));
const SAMPLE_INTERNAL_DOCS_FILE = fileURLToPath(new URL("../../../data/samples/internal_docs.json", import.meta.url));
const ROUTES = {
  health: new Set(["/health", "/api/health"]),
  history: new Set(["/history", "/api/history"]),
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

  return details;
}

function buildAnalyzeInput(payload) {
  return {
    beforeDoc: payload.before ?? readSample(SAMPLE_BEFORE_FILE),
    afterDoc: payload.after ?? readSample(SAMPLE_AFTER_FILE),
    internalDocs: payload.internalDocs ?? readSample(SAMPLE_INTERNAL_DOCS_FILE)
  };
}

export async function handleHealth(req, res) {
  sendJson(res, 200, {
    status: "ok",
    service: "ai-rookie",
    storage: analysisStore.getStorageStatus()
  });
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

    const { beforeDoc, afterDoc, internalDocs } = buildAnalyzeInput(payload);
    const source = detectRunSource(payload);
    const result = runPipeline({ beforeDoc, afterDoc, internalDocs });
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

  if (req.method === "POST" && ROUTES.analyze.has(pathname)) {
    await handleAnalyze(req, res);
    return;
  }

  sendError(res, 404, "NOT_FOUND", "Route not found.");
}
