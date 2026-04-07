# Vercel Deploy

## Import settings
- Import the GitHub repository at the repo root
- `Application Preset: Other` is expected for this project
- Build Command: leave empty
- Output Directory: leave empty

## Required environment variables
- `STORAGE_PROVIDER=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Optional law source variables
- `LAW_SOURCE_PROVIDER=local-fixture`
- `KOREA_LAW_MCP_BASE_URL`
- `KOREA_LAW_MCP_DETAIL_TOOL_NAME`
- `KOREA_LAW_MCP_ID_ARGUMENT_NAME`

Leave `LAW_SOURCE_PROVIDER` as `local-fixture` unless you are deploying a reachable Korea-law-mcp HTTP service behind `KOREA_LAW_MCP_BASE_URL`.
If the MCP server does not use `get_local_ordinance_detail({ ID })` or `get_ordinance_detail({ ID })`, override the tool name and argument name through the two optional env vars instead of changing runtime code on Vercel first.

## Runtime shape
- Static dashboard entrypoint: `/`
- Vercel functions:
  - `/api/health`
  - `/api/source-status`
  - `/api/history`
  - `/api/analyze`
- Backward-compatible rewrites:
  - `/health` -> `/api/health`
  - `/source-status` -> `/api/source-status`
  - `/history` -> `/api/history`
  - `/analyze` -> `/api/analyze`

## Notes
- The dashboard uses `/api/source-status`, `/api/analyze`, and `/api/history`
- Root `index.html` serves the dashboard on Vercel
- Local `npm run start` still supports both `/api/*` and legacy root API paths
