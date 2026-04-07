# SPEC

## Request Summary

Continue the Korea-law MCP integration work by exposing request-level source-provider capability status through the backend and dashboard, while keeping the repo handover/harness files aligned.

## CPS

- Context:
  AI-Rookie can now analyze using `local-fixture` or `korea-law-mcp`, but the dashboard still relies on default `/health` data instead of checking the provider actually selected for the request.
- Problem:
  Users can switch to `korea-law-mcp` in the UI without seeing the exact request-level readiness for that provider, which makes MCP troubleshooting slower and hides missing env/config issues.
- Solution:
  Add a dedicated source-status endpoint, return provider-specific source status metadata, wire the dashboard to query it when the source selector changes, and update tests/docs/handover accordingly.

## Target Users

- Primary:
  Maintainers iterating on AI-Rookie with Codex
- Secondary:
  Demo users switching between sample input and Korea-law MCP-backed inputs

## Goals

- Add a backend endpoint for request-selected law source status
- Let the dashboard query the selected provider directly instead of inferring from `/health`
- Preserve current analyze/history flows and Vercel deployment shape
- Keep harness docs and handover aligned with the new iteration

## Non-Goals

- Verify a public live `korea-law-mcp` deployment end-to-end in this task
- Add ordinance search/lookup UX beyond status reporting
- Redesign the dashboard layout

## Workstreams

1. Add a request-level source status payload builder and HTTP handler.
2. Add a Vercel function entrypoint and rewrite for `/source-status`.
3. Extend Korea-law MCP status metadata with tool-order and argument-name hints.
4. Update the dashboard to fetch source status for the selected provider.
5. Add/refresh tests, smoke coverage, task files, docs, and handover.

## File Touch Plan

- Backend:
  `backend/src/http/app.js`, `backend/src/sources/lawSource.js`, `backend/src/sources/shared.js`, `backend/src/sources/providers/koreaLawMcpSource.js`
- Frontend:
  `frontend/src/app.js`
- API/Vercel:
  `api/source-status.js`, `vercel.json`, `shared/contracts/api.yaml`
- Tests and smoke:
  `tests/http-app.test.js`, `tests/law-source.test.js`, `scripts/smoke.js`
- Docs and task state:
  `README.md`, `docs/07_local_run.md`, `docs/11_progress_board.md`, `docs/13_vercel_deploy.md`, `docs/14_source_adapter_plan.md`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, `docs/09_handover_status.txt`

## Technical Requirements

- Preserve existing Node/Vercel runtime setup
- `/health` stays backward compatible
- `/source-status` must support at least `local-fixture` and `korea-law-mcp`
- Dashboard source status messaging must reflect the selected provider, not only the server default source

## Validation Plan

- `npm run test`
- `npm run smoke` with a local server
- `npm run check`

## Acceptance Criteria

- `GET /source-status?provider=...` returns the selected provider and source status payload
- Korea-law MCP status includes request-useful metadata such as tool order and ID argument name
- Dashboard source messaging updates from `/api/source-status`
- Vercel routing includes the new endpoint
- Tests, smoke, docs, and handover reflect the change
