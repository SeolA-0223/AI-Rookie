import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";
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

test("createLawSource validates korea-law-mcp request ids", async () => {
  const source = createLawSource({
    provider: "korea-law-mcp",
    koreaLawMcpBaseUrl: "http://127.0.0.1:8080"
  });
  const status = source.getSourceStatus();

  assert.equal(status.transport, "streamable-http");
  assert.deepEqual(status.detailToolNames, ["get_local_ordinance_detail", "get_ordinance_detail"]);
  assert.equal(status.idArgumentName, "ID");

  await assert.rejects(() => source.resolveRegulationPair({}), (error) => {
    assert.ok(error instanceof SourceResolutionError);
    assert.equal(error.code, "SOURCE_INPUT_INVALID");
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

async function startMockKoreaLawMcpServer(documentsById, toolNames = ["get_local_ordinance_detail"]) {
  const app = createMcpExpressApp();

  app.post("/mcp", async (req, res) => {
    const server = new McpServer({
      name: "mock-korea-law-mcp",
      version: "1.0.0"
    });

    for (const toolName of toolNames) {
      server.registerTool(toolName, {
        description: "Returns a mock regulation document.",
        inputSchema: {
          ID: z.string()
        }
      }, async ({ ID }) => {
        const document = documentsById[ID];
        if (!document) {
          return {
            content: [{ type: "text", text: `Unknown ordinance ID: ${ID}` }],
            isError: true
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ document }) }],
          structuredContent: { document }
        };
      });
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error)
          },
          id: null
        });
      }
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed."
      },
      id: null
    });
  });

  const httpServer = app.listen(0);
  await once(httpServer, "listening");
  const address = httpServer.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

test("createLawSource prefers get_local_ordinance_detail when the documented tool is available", async () => {
  const server = await startMockKoreaLawMcpServer({
    before: {
      title: "Youth Support Ordinance",
      version: "before",
      clauses: [
        {
          id: "c1",
          title: "Age Requirement",
          text: "Applicants must be between 19 and 29 years old."
        }
      ]
    },
    after: {
      title: "Youth Support Ordinance",
      version: "after",
      clauses: [
        {
          id: "c1",
          title: "Age Requirement",
          text: "Applicants must be between 19 and 34 years old."
        },
        {
          id: "c2",
          title: "Support Amount",
          text: "Support amount is up to 700000 KRW."
        }
      ]
    }
  });

  try {
    const source = createLawSource({
      provider: "korea-law-mcp",
      koreaLawMcpBaseUrl: server.baseUrl
    });

    const pair = await source.resolveRegulationPair({
      beforeId: "before",
      afterId: "after"
    });

    assert.equal(source.getSourceStatus().enabled, true);
    assert.equal(source.getSourceStatus().provider, "korea-law-mcp");
    assert.equal(pair.meta.provider, "korea-law-mcp");
    assert.equal(pair.meta.toolName, "get_local_ordinance_detail");
    assert.equal(pair.beforeDoc.title, "Youth Support Ordinance");
    assert.equal(pair.beforeDoc.clauses.length, 1);
    assert.equal(pair.afterDoc.clauses.length, 2);
    assert.equal(pair.afterDoc.clauses[1].id, "c2");
    assert.match(pair.afterDoc.clauses[1].text, /700000 KRW/);
  } finally {
    await server.close();
  }
});

test("createLawSource falls back to get_ordinance_detail when only the legacy generic tool is exposed", async () => {
  const server = await startMockKoreaLawMcpServer(
    {
      before: {
        title: "Youth Support Ordinance",
        version: "before",
        clauses: [
          {
            id: "c1",
            title: "Age Requirement",
            text: "Applicants must be between 19 and 29 years old."
          }
        ]
      },
      after: {
        title: "Youth Support Ordinance",
        version: "after",
        clauses: [
          {
            id: "c1",
            title: "Age Requirement",
            text: "Applicants must be between 19 and 34 years old."
          }
        ]
      }
    },
    ["get_ordinance_detail"]
  );

  try {
    const source = createLawSource({
      provider: "korea-law-mcp",
      koreaLawMcpBaseUrl: server.baseUrl
    });

    const pair = await source.resolveRegulationPair({
      beforeId: "before",
      afterId: "after"
    });

    assert.equal(pair.meta.toolName, "get_ordinance_detail");
    assert.equal(pair.beforeDoc.title, "Youth Support Ordinance");
    assert.equal(pair.afterDoc.clauses.length, 1);
  } finally {
    await server.close();
  }
});
