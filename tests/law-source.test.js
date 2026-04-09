import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";
import {
  createLawSource,
  recommendLawSourcePair,
  resolveLawSourceProvider,
  searchLawSource,
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
  assert.equal(status.caseCount, 3);
  assert.equal(status.defaultCaseId, "ulsan_youth_job_support");
  assert.equal(pair.meta.provider, "local-fixture");
  assert.ok(Array.isArray(pair.beforeDoc.clauses));
  assert.ok(Array.isArray(pair.afterDoc.clauses));
});

test("createLawSource resolves bundled local fixture case packs by caseId", async () => {
  const source = createLawSource({ provider: "local-fixture" });
  const pair = await source.resolveRegulationPair({
    caseId: "seoul_youth_basic_ordinance"
  });

  assert.equal(pair.meta.provider, "local-fixture");
  assert.equal(pair.meta.mode, "case-pack");
  assert.equal(pair.meta.caseId, "seoul_youth_basic_ordinance");
  assert.match(pair.meta.caseTitle, /Seoul Youth Basic Ordinance/);
  assert.equal(pair.beforeDoc.title, "Seoul Youth Basic Ordinance");
  assert.equal(pair.afterDoc.title, "Seoul Youth Basic Ordinance");
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
  assert.deepEqual(status.searchToolNames, ["search_local_ordinance"]);
  assert.equal(status.searchQueryArgumentName, "query");

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

async function startMockKoreaLawMcpServer({
  documentsById,
  detailToolNames = ["get_local_ordinance_detail"],
  searchResultsByQuery = {}
}) {
  const app = createMcpExpressApp();

  app.post("/mcp", async (req, res) => {
    const server = new McpServer({
      name: "mock-korea-law-mcp",
      version: "1.0.0"
    });

    for (const toolName of detailToolNames) {
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

    server.registerTool("search_local_ordinance", {
      description: "Searches mock ordinance metadata.",
      inputSchema: {
        query: z.string()
      }
    }, async ({ query }) => {
      const results = searchResultsByQuery[query] ?? [];

      return {
        content: [{ type: "text", text: JSON.stringify({ results }) }],
        structuredContent: { results }
      };
    });

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

async function startMockLawGoPublicServer({
  searchResultsByQuery = {},
  documentsById = {},
  historyEntriesById = {},
  htmlSearchResultsByQuery = {}
}) {
  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url, "http://127.0.0.1");

    if (requestUrl.pathname === "/DRF/lawSearch.do") {
      const query = requestUrl.searchParams.get("query") ?? "";
      const law = searchResultsByQuery[query] ?? [];

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ OrdinSearch: { law } }));
      return;
    }

    if (requestUrl.pathname === "/LSW/ordinInfoP.do") {
      const ordinSeq = requestUrl.searchParams.get("ordinSeq") ?? "";
      const document = documentsById[ordinSeq];

      if (!document) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body>
            <input type="hidden" id="ordinSeq" value="${document.ordinSeq}" />
            <input type="hidden" id="ancYd" value="${document.ancYd}" />
            <input type="hidden" id="ancNo" value="${document.ancNo}" />
            <input type="hidden" id="ordinNm" value="${document.title}" />
            <input type="hidden" id="lgovOrgCd" value="${document.lgovOrgCd ?? ""}" />
            <h2>${document.title}</h2>
          </body>
        </html>
      `);
      return;
    }

    if (requestUrl.pathname === "/LSW/ordinScListR.do") {
      const query = requestUrl.searchParams.get("q") ?? "";
      const results = htmlSearchResultsByQuery[query] ?? [];

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body>
            <div id="list_listR">
              <div id="lelistwrapLeft" class="left_area">
                <ul class="left_list_bx type02">
                  ${results
                    .map(
                      (result, index) => `
                        <li id="liBgcolor${index}">
                          <a href="#AJAX" onclick="ordinViewAll('${result.id}','liBgcolor${index}', '0','${result.gubun ?? "ELIS"}','${result.current ? "1" : "0"}'); return false;">
                            <span class="tx">${index + 1}. ${result.title}</span>
                            <span class="tx2">[시행 ${result.effectiveDateLabel}] [${result.announcementLabel}, ${result.promulgationDateLabel}, ${result.amendmentType}]</span>
                          </a>
                        </li>
                      `
                    )
                    .join("\n")}
                </ul>
              </div>
            </div>
          </body>
        </html>
      `);
      return;
    }

    if (requestUrl.pathname === "/LSW/ordinHstListR.do") {
      const ordinSeq = requestUrl.searchParams.get("ordinSeq") ?? "";
      const historyEntries = historyEntriesById[ordinSeq] ?? [];

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body>
            ${historyEntries
              .map(
                (entry) => `
                  <a href="#history-${entry.id}" onclick="javascript:ordinViewOrdinHst('${entry.id}','${entry.current ? "Y" : "N"}');return false;">
                    ${entry.index}. ${entry.title}<br />
                    [시행 ${entry.effectiveDateLabel}] [${entry.announcementLabel}, ${entry.promulgationDateLabel}, ${entry.amendmentType}]
                  </a>
                `
              )
              .join("\n")}
          </body>
        </html>
      `);
      return;
    }

    if (requestUrl.pathname === "/LSW/ordinJoListRInc_XML.do") {
      const ordinSeq = requestUrl.searchParams.get("ordinSeq") ?? "";
      const document = documentsById[ordinSeq];

      if (!document) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end("[]");
        return;
      }

      const clauseList = document.clauses.map((clause) => ({
        joTit: clause.title,
        joNo: clause.joNo,
        cls: "joNo",
        oriJoNo: clause.oriJoNo,
        joYn: "Y",
        joLink: `${Number.parseInt(clause.oriJoNo, 10)}:0`,
        chapNo: "00000000000000000000",
        joChgYn: "",
        joBrNo: clause.joBrNo
      }));

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(clauseList));
      return;
    }

    if (requestUrl.pathname === "/LSW/ordinBdyPrint.do") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }

      const body = Buffer.concat(chunks).toString("utf8");
      const params = new URLSearchParams(body);
      const ordinSeq = params.get("ordinSeq") ?? "";
      const document = documentsById[ordinSeq];

      if (!document) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const selectedClauseIds = new Set(params.getAll("joNo"));
      const selectedClauses = document.clauses.filter((clause) =>
        selectedClauseIds.has(`${clause.oriJoNo}:${clause.joBrNo}`)
      );

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body>
            <div class="confnla1">
              <h2>${document.title}</h2>
              <div class="subtit1">${document.version}</div>
              ${selectedClauses
                .map(
                  (clause) => `
                    <p class="pty1_p2">
                      <span class="bl"><label for="${clause.joNo}">${clause.printTitle}</label></span>
                      ${clause.text}
                    </p>
                  `
                )
                .join("\n")}
            </div>
          </body>
        </html>
      `);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });

  server.listen(0);
  await once(server, "listening");
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((error) => {
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
    documentsById: {
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

test("searchLawSource normalizes ordinance search results through korea-law-mcp", async () => {
  const server = await startMockKoreaLawMcpServer({
    documentsById: {},
    searchResultsByQuery: {
      "seoul youth support": [
        {
          id: "seoul-001",
          ordinanceTitle: "Seoul Youth Support Ordinance",
          localGovernment: "Seoul",
          effectiveDate: "2026-01-01",
          promulgationDate: "2025-12-20",
          detailUrl: "https://example.com/ordinances/seoul-001",
          summary: "Updated support rules for youth programs."
        }
      ]
    }
  });

  try {
    const result = await searchLawSource({
      provider: "korea-law-mcp",
      koreaLawMcpBaseUrl: server.baseUrl,
      query: "seoul youth support",
      limit: 5
    });

    assert.equal(result.meta.provider, "korea-law-mcp");
    assert.equal(result.meta.toolName, "search_local_ordinance");
    assert.equal(result.meta.queryArgumentName, "query");
    assert.equal(result.results.length, 1);
    assert.deepEqual(result.results[0], {
      id: "seoul-001",
      title: "Seoul Youth Support Ordinance",
      jurisdiction: "Seoul",
      effectiveDate: "2026-01-01",
      promulgationDate: "2025-12-20",
      referenceUrl: "https://example.com/ordinances/seoul-001",
      summary: "Updated support rules for youth programs."
    });
  } finally {
    await server.close();
  }
});

test("createLawSource returns empty search results for local fixture source", async () => {
  const result = await searchLawSource({
    provider: "local-fixture",
    query: "sample"
  });

  assert.equal(result.meta.provider, "local-fixture");
  assert.deepEqual(result.results, []);
});

test("createLawSource enables law-go-public without extra environment variables", async () => {
  const source = createLawSource({ provider: "law-go-public" });
  const status = source.getSourceStatus();

  assert.equal(status.provider, "law-go-public");
  assert.equal(status.enabled, true);
  assert.equal(status.transport, "official-http");
  assert.equal(status.ocMode, "test-demo");
});

test("searchLawSource normalizes official ordinance search results through law-go-public", async () => {
  const server = await startMockLawGoPublicServer({
    searchResultsByQuery: {
      "seoul youth support": [
        {
          자치법규명: "Seoul Youth Support Ordinance",
          자치법규일련번호: "1853703",
          시행일자: "20230922",
          공포일자: "20230922",
          지자체기관명: "Seoul",
          자치법규종류: "Ordinance",
          제개정구분명: "Partial Revision",
          자치법규분야명: "Youth"
        }
      ]
    }
  });

  try {
    const result = await searchLawSource({
      provider: "law-go-public",
      lawGoBaseUrl: server.baseUrl,
      query: "seoul youth support",
      limit: 5
    });

    assert.equal(result.meta.provider, "law-go-public");
    assert.equal(result.meta.ocMode, "test-demo");
    assert.equal(result.meta.searchBackend, "drf");
    assert.equal(result.results.length, 1);
    assert.deepEqual(result.results[0], {
      id: "1853703",
      title: "Seoul Youth Support Ordinance",
      jurisdiction: "Seoul",
      effectiveDate: "2023-09-22",
      promulgationDate: "2023-09-22",
      referenceUrl: `${server.baseUrl}/LSW/ordinInfoP.do?urlMode=ordinScJoRltInfoR&viewCls=ordinInfoP&ordinSeq=1853703&chrClsCd=010202&gubun=ELIS`,
      summary: "Ordinance / Partial Revision / Youth"
    });
  } finally {
    await server.close();
  }
});

test("searchLawSource falls back to public HTML search when DRF search returns no results", async () => {
  const server = await startMockLawGoPublicServer({
    searchResultsByQuery: {
      "서울특별시 청년 기본 조례": []
    },
    htmlSearchResultsByQuery: {
      "서울특별시 청년 기본 조례": [
        {
          id: "1840747",
          title: "서울특별시 청년 기본 조례",
          effectiveDateLabel: "2023. 7. 24.",
          announcementLabel: "서울특별시조례 제8862호",
          promulgationDateLabel: "2023. 7. 24.",
          amendmentType: "타법개정",
          current: true
        },
        {
          id: "1800444",
          title: "서울특별시 청년 기본 조례",
          effectiveDateLabel: "2023. 1. 5.",
          announcementLabel: "서울특별시조례 제8451호",
          promulgationDateLabel: "2023. 1. 5.",
          amendmentType: "일부개정",
          current: false
        }
      ]
    }
  });

  try {
    const result = await searchLawSource({
      provider: "law-go-public",
      lawGoBaseUrl: server.baseUrl,
      query: "서울특별시 청년 기본 조례",
      limit: 5
    });
    const recommendation = recommendLawSourcePair(result.results, "서울특별시 청년 기본 조례");

    assert.equal(result.meta.provider, "law-go-public");
    assert.equal(result.meta.searchBackend, "html-fallback");
    assert.equal(result.results.length, 2);
    assert.deepEqual(
      result.results.map((item) => item.id),
      ["1840747", "1800444"]
    );
    assert.equal(result.results[0].title, "서울특별시 청년 기본 조례");
    assert.equal(result.results[0].effectiveDate, "2023-07-24");
    assert.equal(result.results[0].summary, "Public search / 타법개정");
    assert.equal(recommendation.before.id, "1800444");
    assert.equal(recommendation.after.id, "1840747");
  } finally {
    await server.close();
  }
});

test("searchLawSource expands ordinance history for law-go-public and enables pair recommendation", async () => {
  const server = await startMockLawGoPublicServer({
    searchResultsByQuery: {
      "seoul youth support ordinance": [
        {
          자치법규명: "Seoul Youth Support Ordinance",
          자치법규일련번호: "1853703",
          시행일자: "20230922",
          공포일자: "20230922",
          지자체기관명: "Seoul",
          자치법규종류: "Ordinance",
          제개정구분명: "Partial Revision",
          자치법규분야명: "Youth"
        }
      ]
    },
    historyEntriesById: {
      "1853703": [
        {
          id: "1853703",
          index: 1,
          title: "Seoul Youth Support Ordinance",
          effectiveDateLabel: "2023. 9. 22.",
          announcementLabel: "서울특별시조례 제1568호",
          promulgationDateLabel: "2023. 9. 22.",
          amendmentType: "일부개정",
          current: true
        },
        {
          id: "1853702",
          index: 2,
          title: "Seoul Youth Support Ordinance",
          effectiveDateLabel: "2022. 1. 1.",
          announcementLabel: "서울특별시조례 제1200호",
          promulgationDateLabel: "2022. 1. 1.",
          amendmentType: "일부개정",
          current: false
        },
        {
          id: "1853701",
          index: 3,
          title: "Seoul Youth Support Ordinance",
          effectiveDateLabel: "2020. 1. 1.",
          announcementLabel: "서울특별시조례 제900호",
          promulgationDateLabel: "2020. 1. 1.",
          amendmentType: "제정",
          current: false
        }
      ]
    }
  });

  try {
    const result = await searchLawSource({
      provider: "law-go-public",
      lawGoBaseUrl: server.baseUrl,
      query: "seoul youth support ordinance",
      limit: 5
    });
    const recommendation = recommendLawSourcePair(result.results, "seoul youth support ordinance");

    assert.equal(result.meta.provider, "law-go-public");
    assert.equal(result.meta.historyExpanded, true);
    assert.equal(result.meta.historySeedId, "1853703");
    assert.equal(result.results.length, 3);
    assert.deepEqual(
      result.results.map((item) => item.id),
      ["1853703", "1853702", "1853701"]
    );
    assert.deepEqual(
      result.results.map((item) => item.effectiveDate),
      ["2023-09-22", "2022-01-01", "2020-01-01"]
    );
    assert.equal(recommendation.before.id, "1853702");
    assert.equal(recommendation.after.id, "1853703");
    assert.equal(recommendation.confidence, "high");
  } finally {
    await server.close();
  }
});

test("createLawSource resolves ordinance pairs through the public law.go.kr flow", async () => {
  const server = await startMockLawGoPublicServer({
    documentsById: {
      "1853702": {
        ordinSeq: "1853702",
        ancYd: "20220101",
        ancNo: "1200",
        title: "Seoul Youth Support Ordinance",
        version: "[시행 2022. 1. 1.] [서울특별시조례 제1200호, 2022. 1. 1., 일부개정]",
        clauses: [
          {
            joNo: "000100",
            oriJoNo: "0001",
            joBrNo: "00",
            title: "제1조 목적",
            printTitle: "제1조(목적)",
            text: "청년 지원의 기본 원칙을 규정한다."
          },
          {
            joNo: "000200",
            oriJoNo: "0002",
            joBrNo: "00",
            title: "제2조 정의",
            printTitle: "제2조(정의)",
            text: "청년은 19세 이상 29세 이하로 본다."
          }
        ]
      },
      "1853703": {
        ordinSeq: "1853703",
        ancYd: "20230922",
        ancNo: "1568",
        title: "Seoul Youth Support Ordinance",
        version: "[시행 2023. 9. 22.] [서울특별시조례 제1568호, 2023. 9. 22., 일부개정]",
        clauses: [
          {
            joNo: "000100",
            oriJoNo: "0001",
            joBrNo: "00",
            title: "제1조 목적",
            printTitle: "제1조(목적)",
            text: "청년 지원의 기본 원칙과 자립 기반 형성을 규정한다."
          },
          {
            joNo: "000200",
            oriJoNo: "0002",
            joBrNo: "00",
            title: "제2조 정의",
            printTitle: "제2조(정의)",
            text: "청년은 19세 이상 34세 이하로 본다."
          },
          {
            joNo: "000300",
            oriJoNo: "0003",
            joBrNo: "00",
            title: "제3조 지원사업",
            printTitle: "제3조(지원사업)",
            text: "구청장은 취업, 주거, 금융 지원 사업을 추진할 수 있다."
          }
        ]
      }
    }
  });

  try {
    const source = createLawSource({
      provider: "law-go-public",
      lawGoBaseUrl: server.baseUrl
    });

    const pair = await source.resolveRegulationPair({
      beforeId: "1853702",
      afterId: `${server.baseUrl}/LSW/ordinInfoP.do?ordinSeq=1853703`
    });

    assert.equal(pair.meta.provider, "law-go-public");
    assert.equal(pair.meta.beforeId, "1853702");
    assert.equal(pair.meta.afterId, "1853703");
    assert.equal(pair.beforeDoc.title, "Seoul Youth Support Ordinance");
    assert.equal(pair.afterDoc.version, "[시행 2023. 9. 22.] [서울특별시조례 제1568호, 2023. 9. 22., 일부개정]");
    assert.equal(pair.beforeDoc.clauses.length, 2);
    assert.equal(pair.afterDoc.clauses.length, 3);
    assert.deepEqual(pair.afterDoc.clauses[1], {
      id: "0002:00",
      title: "제2조(정의)",
      text: "청년은 19세 이상 34세 이하로 본다."
    });
  } finally {
    await server.close();
  }
});

test("recommendLawSourcePair picks the latest two dated versions from the best-matching ordinance group", () => {
  const recommendation = recommendLawSourcePair(
    [
      {
        id: "seoul-2022",
        title: "Seoul Youth Support Ordinance",
        jurisdiction: "Seoul",
        effectiveDate: "2022-01-01",
        promulgationDate: "2021-12-20"
      },
      {
        id: "seoul-2024",
        title: "Seoul Youth Support Ordinance",
        jurisdiction: "Seoul",
        effectiveDate: "2024-01-01",
        promulgationDate: "2023-12-20"
      },
      {
        id: "seoul-2023",
        title: "Seoul Youth Support Ordinance",
        jurisdiction: "Seoul",
        effectiveDate: "2023-01-01",
        promulgationDate: "2022-12-20"
      },
      {
        id: "busan-2024",
        title: "Busan Youth Support Ordinance",
        jurisdiction: "Busan",
        effectiveDate: "2024-01-01",
        promulgationDate: "2023-12-20"
      }
    ],
    "Seoul youth support ordinance"
  );

  assert.equal(recommendation.strategy, "timeline-heuristic");
  assert.equal(recommendation.confidence, "high");
  assert.equal(recommendation.before.id, "seoul-2023");
  assert.equal(recommendation.after.id, "seoul-2024");
  assert.equal(recommendation.matchCount, 3);
  assert.match(recommendation.reason, /Seoul Youth Support Ordinance/);
});

test("createLawSource falls back to get_ordinance_detail when only the legacy generic tool is exposed", async () => {
  const server = await startMockKoreaLawMcpServer({
    documentsById: {
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
    detailToolNames: ["get_ordinance_detail"]
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

    assert.equal(pair.meta.toolName, "get_ordinance_detail");
    assert.equal(pair.beforeDoc.title, "Youth Support Ordinance");
    assert.equal(pair.afterDoc.clauses.length, 1);
  } finally {
    await server.close();
  }
});
