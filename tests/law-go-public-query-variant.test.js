import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import { searchLawSource } from "../backend/src/sources/lawSource.js";

function startMockServer({ rawQuery, cleanedQuery, result }) {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");

    if (requestUrl.pathname === "/DRF/lawSearch.do") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ law: [] }));
      return;
    }

    if (requestUrl.pathname === "/LSW/ordinScListR.do") {
      const query = requestUrl.searchParams.get("q") ?? "";
      const results = query === cleanedQuery ? [result] : query === rawQuery ? [] : [];

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body>
            <div id="list_listR">
              <div id="lelistwrapLeft" class="left_area">
                <ul class="left_list_bx type02">
                  ${results
                    .map(
                      (entry, index) => `
                        <li id="liBgcolor${index}">
                          <a href="#AJAX" onclick="ordinViewAll('${entry.id}','liBgcolor${index}', '0','ELIS','1'); return false;">
                            <span class="tx">${index + 1}. ${entry.title}</span>
                            <span class="tx2">[시행 ${entry.effectiveDateLabel}] [서울특별시조례 제8862호, ${entry.promulgationDateLabel}, 일부개정]</span>
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

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          })
      });
    });
  });
}

test("searchLawSource strips guidance suffix variants for law.go.kr search", async () => {
  const rawQuery = "서울특별시 청년 기본 조례 안내문";
  const cleanedQuery = "서울특별시 청년 기본 조례";
  const expectedTitle = "서울특별시 청년 기본 조례";
  const server = await startMockServer({
    rawQuery,
    cleanedQuery,
    result: {
      id: "1840747",
      title: expectedTitle,
      effectiveDateLabel: "2023. 7. 24.",
      promulgationDateLabel: "2023. 7. 24."
    }
  });

  try {
    const result = await searchLawSource({
      provider: "law-go-public",
      lawGoBaseUrl: server.baseUrl,
      query: rawQuery,
      limit: 5
    });

    assert.equal(result.meta.provider, "law-go-public");
    assert.equal(result.meta.searchBackend, "html-fallback");
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].id, "1840747");
    assert.equal(result.results[0].title, expectedTitle);
    assert.equal(result.meta.diagnostics.queryVariants[0], rawQuery);
    assert.ok(result.meta.diagnostics.queryVariants.includes(cleanedQuery));
  } finally {
    await server.close();
  }
});
