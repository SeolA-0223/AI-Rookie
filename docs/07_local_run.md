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
Runs the pipeline against sample data, prints metrics JSON, and updates `data/eval/metrics.json`.

```bash
npm run eval
```

## 4) Start API server
```bash
npm run start
```

Default server URL is `http://127.0.0.1:3000`.
Default storage provider is `local`.
If you set `STORAGE_PROVIDER=supabase` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, analysis runs will also be saved to Supabase.
If `STORAGE_PROVIDER` is empty and `SUPABASE_URL` is set, the runtime keeps the previous auto-detect behavior and selects `supabase`.
Default law source provider is `local-fixture`, which serves the sample regulation pair.

If you want to exercise the source-adapter path, send a request with a `source` object instead of inline `before`/`after` payloads:

```json
{
  "source": {
    "provider": "local-fixture"
  }
}
```

`korea-law-mcp` is reserved as the next adapter slot:

```powershell
$env:LAW_SOURCE_PROVIDER="korea-law-mcp"
$env:KOREA_LAW_MCP_BASE_URL="http://127.0.0.1:8080"
```

At the moment, that adapter returns a controlled `not implemented` error until the actual MCP transport is wired in.

## 5) Run smoke check (in another terminal)
Hits `GET /health`, `POST /analyze`, and `GET /history` and validates response shape.

```bash
npm run smoke
```

If you run server on a custom port, set `BASE_URL`:

```powershell
$env:PORT=3100; npm run start
$env:BASE_URL="http://127.0.0.1:3100"; npm run smoke
```

## 6) Local quick check
Runs tests + eval (does not include smoke).

```bash
npm run check
```

## 7) Supabase setup
See `docs/12_supabase_setup.md` for remote project creation, migration push, and runtime env vars.
