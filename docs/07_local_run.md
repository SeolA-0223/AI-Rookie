# Local Run Guide

## Prerequisites
- Node.js 20+ (Node.js 24 recommended to match CI)
- npm

## 1) Install dependencies
```bash
npm install
```

## 2) Run unit tests
```bash
npm run test
```

## 3) Run pipeline evaluation
Runs the pipeline against the default sample data and every municipality case pack under `data/cases/*`, prints metrics JSON, and updates `data/eval/metrics.json`.

```bash
npm run eval
```

`data/eval/metrics.json` now keeps:

- the default sample report at the top level
- `caseSuite.summary` for aggregate pass/fail and average metrics
- `caseSuite.cases[]` for per-case metrics and checks

## 4) Start API server
```bash
npm run start
```

Default server URL is `http://127.0.0.1:3000`.
Default storage provider is `local`.
If you set `STORAGE_PROVIDER=supabase` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, analysis runs will also be saved to Supabase.
If `STORAGE_PROVIDER` is empty and `SUPABASE_URL` is set, the runtime keeps the previous auto-detect behavior and selects `supabase`.
Default law source provider is `local-fixture`, which serves the sample regulation pair.
The dashboard now includes an `Analysis Source` panel for switching between sample input, `law-go-public`, and `korea-law-mcp`.
The default `local-fixture` sample currently mirrors the Ulsan youth job-support case pack in `data/cases/ulsan_youth_job_support`.
Additional normalized municipality case packs are listed in `data/cases/case_catalog.json`.
The dashboard also loads `/case-catalog` so you can switch bundled local-fixture case packs without editing sample files.

If you want to exercise the source-adapter path, send a request with a `source` object instead of inline `before`/`after` payloads:

```json
{
  "source": {
    "provider": "local-fixture",
    "caseId": "seoul_youth_basic_ordinance"
  }
}
```

`law-go-public` uses official `law.go.kr` search and public ordinance-print endpoints. It works without additional environment variables, but you can override the base URL or OC if needed:

```powershell
$env:LAW_SOURCE_PROVIDER="law-go-public"
$env:LAW_GO_BASE_URL="https://www.law.go.kr"
$env:LAW_GO_OC=""
```

Then call `/analyze` with ordinance sequence IDs:

```json
{
  "source": {
    "provider": "law-go-public",
    "beforeId": "1840747",
    "afterId": "1840747"
  }
}
```

`law-go-public` search now expands a high-confidence single result with `ordinHstListR.do` history entries, so `/source-search` can recommend a pre/post pair when the public site exposes ordinance history.
If the public DRF search returns no structured rows, AI-Rookie now falls back to the public HTML list endpoint `ordinScListR.do`.
The default public demo `LAW_GO_OC=test` still returns sparse or empty search results in some cases. For reliable search, set a real `LAW_GO_OC`. If `recommendation` is still `null`, use known ordinance sequence IDs directly.

`korea-law-mcp` uses a Streamable HTTP MCP endpoint. If the endpoint is running locally, the adapter auto-resolves `/mcp` when only the host/port is provided:

```powershell
$env:LAW_SOURCE_PROVIDER="korea-law-mcp"
$env:KOREA_LAW_MCP_BASE_URL="http://127.0.0.1:8080"
$env:KOREA_LAW_MCP_DETAIL_TOOL_NAME="get_local_ordinance_detail"
$env:KOREA_LAW_MCP_ID_ARGUMENT_NAME="ID"
$env:KOREA_LAW_MCP_SEARCH_TOOL_NAME="search_local_ordinance"
$env:KOREA_LAW_MCP_SEARCH_QUERY_ARGUMENT_NAME="query"
```

Then call `/analyze` with source IDs:

```json
{
  "source": {
    "provider": "korea-law-mcp",
    "beforeId": "ordinance-before-id",
    "afterId": "ordinance-after-id"
  }
}
```

If your MCP server exposes a different tool contract, change `KOREA_LAW_MCP_DETAIL_TOOL_NAME`, `KOREA_LAW_MCP_ID_ARGUMENT_NAME`, `KOREA_LAW_MCP_SEARCH_TOOL_NAME`, and `KOREA_LAW_MCP_SEARCH_QUERY_ARGUMENT_NAME` instead of patching the API code first.
If the tool-name override is left blank, AI-Rookie first tries `get_local_ordinance_detail` and then falls back to `get_ordinance_detail`.

The same flow is available in the dashboard:

1. Open `/`
2. In `Analysis Source`, either keep `Local Fixture` and choose a bundled case pack, or switch to `law.go.kr Public` / `Korea Law MCP`
3. Search by ordinance title if you need candidate IDs
4. If the server finds a timeline recommendation, click `Use Recommended Pair`
5. Or use individual search results to fill `Before ID` and `After ID` manually
6. Click `Run Analysis`

## 5) Run smoke check (in another terminal)
Hits `GET /health`, `GET /case-catalog`, `GET /source-status`, `GET /source-search`, `POST /analyze`, and `GET /history` and validates response shape.

```bash
npm run smoke
```

If you run server on a custom port, set `BASE_URL`:

```powershell
$env:PORT=3100; npm run start
$env:BASE_URL="http://127.0.0.1:3100"; npm run smoke
```

To inspect the request-selected source provider directly:

```powershell
Invoke-RestMethod "http://127.0.0.1:3000/source-status?provider=korea-law-mcp"
Invoke-RestMethod "http://127.0.0.1:3000/source-status?provider=law-go-public"
```

To inspect bundled case packs directly:

```powershell
Invoke-RestMethod "http://127.0.0.1:3000/case-catalog"
```

To search ordinance candidates directly:

```powershell
Invoke-RestMethod "http://127.0.0.1:3000/source-search?provider=korea-law-mcp&query=서울시%20청년%20지원%20조례"
Invoke-RestMethod "http://127.0.0.1:3000/source-search?provider=law-go-public&query=서울시%20청년%20지원%20조례"
```

If the response includes `recommendation`, AI-Rookie judged that the returned candidates include a plausible pre/post amendment pair based on title and ordinance dates.

## 6) Local quick check
Runs tests + eval (does not include smoke).

```bash
npm run check
```

## 7) Municipality case packs
Use these files when you want to inspect or extend the normalized demo cases without changing runtime code:

- `data/cases/ulsan_youth_job_support`
- `data/cases/bucheon_youth_rent_support`
- `data/cases/seoul_youth_basic_ordinance`

Each case pack contains:

- `meta.json`: official ordinance metadata and source URL
- `before.json`: normalized pre-amendment clauses
- `after.json`: normalized post-amendment clauses
- `internal_docs.json`: internal-document fixtures used by impact mapping

The official metadata is grounded in the Ministry of Government Legislation pages, but the clause text remains a normalized demo excerpt for pipeline evaluation.

## 8) Supabase setup
See `docs/12_supabase_setup.md` for remote project creation, migration push, and runtime env vars.
