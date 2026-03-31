import http from "node:http";
import fs from "node:fs";
import { PipelineValidationError, runPipeline } from "./pipeline/runPipeline.js";

const PORT = process.env.PORT || 3000;
const MAX_BODY_BYTES = 1024 * 1024;
const ALLOWED_ANALYZE_FIELDS = new Set(["before", "after", "internalDocs"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readSample(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
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

function collectJson(req) {
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

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok", service: "ai-rookie" });
    return;
  }

  if (req.method === "POST" && req.url === "/analyze") {
    try {
      const payload = await collectJson(req);
      const requestErrors = validateAnalyzeRequest(payload);
      if (requestErrors.length > 0) {
        sendError(res, 400, "INVALID_REQUEST", "Analyze request is invalid.", requestErrors);
        return;
      }

      const beforeDoc = payload.before ?? readSample("data/samples/regulation_before.json");
      const afterDoc = payload.after ?? readSample("data/samples/regulation_after.json");
      const internalDocs = payload.internalDocs ?? readSample("data/samples/internal_docs.json");

      const result = runPipeline({ beforeDoc, afterDoc, internalDocs });
      sendJson(res, 200, result);
      return;
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
      return;
    }
  }

  sendError(res, 404, "NOT_FOUND", "Route not found.");
});

server.listen(PORT, () => {
  console.log(`AI-Rookie API running on http://localhost:${PORT}`);
});
