import http from "node:http";
import fs from "node:fs";
import { runPipeline } from "./pipeline/runPipeline.js";

const PORT = process.env.PORT || 3000;

function readSample(path) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function collectJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok", service: "ai-rookie" });
    return;
  }

  if (req.method === "POST" && req.url === "/analyze") {
    try {
      const payload = await collectJson(req);
      const beforeDoc = payload.before ?? readSample("data/samples/regulation_before.json");
      const afterDoc = payload.after ?? readSample("data/samples/regulation_after.json");
      const internalDocs = payload.internalDocs ?? readSample("data/samples/internal_docs.json");

      const result = runPipeline({ beforeDoc, afterDoc, internalDocs });
      sendJson(res, 200, result);
      return;
    } catch (error) {
      sendJson(res, 400, { error: "Invalid request body", detail: String(error.message ?? error) });
      return;
    }
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`AI-Rookie API running on http://localhost:${PORT}`);
});
