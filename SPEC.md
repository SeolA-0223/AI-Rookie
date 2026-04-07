# SPEC

## Request Summary

Continue the Korea-law MCP work by adding a search helper around `search_local_ordinance`, exposing it through the backend, and wiring the dashboard so users can find usable ordinance IDs before running analysis.

## CPS

- Context:
  AI-Rookie can already fetch ordinance details from Korea-law MCP, but users still need raw `beforeId` and `afterId` values up front.
- Problem:
  Requiring raw ordinance IDs makes the MCP flow awkward and blocks realistic demos because users usually know the ordinance title, not the ID.
- Solution:
  Add a request-level source search endpoint, normalize Korea-law MCP search results, and let the dashboard search by ordinance title then apply candidates to the before/after ID fields.

## Target Users

- Primary:
  Maintainers iterating on AI-Rookie with Codex
- Secondary:
  Demo users trying ordinance-backed analysis without knowing raw IDs

## Goals

- Add a source-search backend endpoint
- Normalize `search_local_ordinance` results from Korea-law MCP
- Let the dashboard search and apply candidates to `Before` / `After` IDs
- Preserve current analyze/history/status flows and update docs/handover

## Non-Goals

- Prove a public live `korea-law-mcp` deployment in this task
- Automatically choose before/after versions from search results
- Replace the current analysis pipeline or storage flow

## Workstreams

1. Add search support to law source adapters and Korea-law MCP provider metadata.
2. Add `/source-search` to the HTTP layer and Vercel routing.
3. Add dashboard search input, search results, and candidate application buttons.
4. Extend tests and smoke coverage.
5. Update contracts, docs, progress board, and handover.

## File Touch Plan

- Backend:
  `backend/src/http/app.js`, `backend/src/sources/lawSource.js`, `backend/src/sources/shared.js`, `backend/src/sources/providers/localFixtureLawSource.js`, `backend/src/sources/providers/koreaLawMcpSource.js`
- Frontend:
  `frontend/index.html`, `index.html`, `frontend/src/app.js`, `frontend/src/styles.css`
- API/Vercel:
  `api/source-search.js`, `vercel.json`, `shared/contracts/api.yaml`
- Tests and smoke:
  `tests/http-app.test.js`, `tests/law-source.test.js`, `scripts/smoke.js`
- Docs and task state:
  `.env.example`, `README.md`, `docs/07_local_run.md`, `docs/11_progress_board.md`, `docs/13_vercel_deploy.md`, `docs/14_source_adapter_plan.md`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, `docs/09_handover_status.txt`

## Technical Requirements

- Preserve existing Node/Vercel runtime setup
- Search defaults should follow the public README contract: `search_local_ordinance` with `query`
- Search behavior must remain overrideable through env vars
- Dashboard search must not block the existing direct-ID path

## Validation Plan

- `npm run test`
- `npm run smoke` with a local server
- `npm run check`

## Acceptance Criteria

- `GET /source-search?provider=...&query=...` returns normalized results
- Korea-law MCP status exposes search-tool metadata
- Dashboard can search and apply candidate IDs to before/after fields
- Vercel routing includes the new endpoint
- Tests, smoke, docs, and handover reflect the search helper flow
