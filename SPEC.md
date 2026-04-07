# SPEC

## Request Summary

Continue the Korea-law MCP flow by adding a server-side `before` / `after` recommendation heuristic on top of `/source-search`, wiring it into the dashboard, and leaving a clear handover note about the still-unverified live MCP contract.

## CPS

- Context:
  AI-Rookie already supports request-level source status/search and can fetch ordinance detail documents through Korea-law MCP adapters.
- Problem:
  Users can search ordinance IDs, but they still have to decide manually which candidate should be treated as the `before` version and which should be the `after` version.
- Solution:
  Add a timeline-based recommendation heuristic that groups search results by ordinance identity, uses ordinance date metadata to pick the latest two versions, and exposes that recommendation through both the API and the dashboard.

## Target Users

- Primary:
  Maintainers iterating on AI-Rookie with Codex
- Secondary:
  Demo users who can search by ordinance title but do not know the correct `beforeId` / `afterId`

## Goals

- Add 3 municipality-oriented normalized case packs under `data/cases`
- Add a recommendation object to `/source-search`
- Use recommendation data in the dashboard to fill `Before ID` and `After ID`
- Keep current source-status, source-search, analyze, and history flows stable
- Update docs, harness files, progress tracking, and handover for the next session

## Non-Goals

- Prove a public live `korea-law-mcp` deployment in this task
- Install Python/uv in this workspace just to validate the upstream server
- Replace the current analysis pipeline or storage flow

## Workstreams

1. Add a reusable recommendation heuristic to the law-source layer.
2. Include the recommendation in `/source-search` payloads.
3. Render the recommendation in the dashboard with a one-click apply action.
4. Extend tests, smoke, contracts, docs, and handover.

## File Touch Plan

- Backend:
  `backend/src/http/app.js`, `backend/src/sources/lawSource.js`
- Frontend:
  `frontend/index.html`, `frontend/src/app.js`, `frontend/src/styles.css`
- Tests and contracts:
  `tests/law-source.test.js`, `tests/http-app.test.js`, `scripts/smoke.js`, `shared/contracts/api.yaml`
- Docs and task state:
  `README.md`, `docs/07_local_run.md`, `docs/11_progress_board.md`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, `docs/09_handover_status.txt`

## Technical Requirements

- Preserve the existing Node/Vercel runtime setup and request-level source workflow
- Recommendation must remain optional; when no plausible pair exists, the API should return `recommendation: null`
- Heuristic should prefer same-title, same-jurisdiction results with usable ordinance dates
- Current mock integration tests and smoke flow must continue to pass

## Validation Plan

- `npm run test`
- `npm run check`
- `npm run smoke` with a local server

## Acceptance Criteria

- `/source-search` returns `recommendation` when a plausible timeline pair exists and `null` otherwise
- Dashboard can apply the recommended pair into `Before ID` / `After ID`
- `npm run test`, `npm run check`, and local `npm run smoke` pass
- README, local-run guide, progress board, and handover reflect the recommendation workflow
