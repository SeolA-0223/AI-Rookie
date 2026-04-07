# SPEC

## Request Summary

Refactor AI-Rookie so future work follows a reusable Codex harness structure based on the `Harness Engineering` reference materials, then continue the next product iteration by making the dashboard drive source-based analysis instead of only hardcoded sample runs.

## CPS

- Context:
  AI-Rookie already has provider-based storage and law-source adapters, but the working process is still ad hoc and the dashboard cannot drive the new source-provider path.
- Problem:
  Future sessions can easily drift because the repo lacks a root orchestrator, strict role files, and automatic harness checks. Separately, the frontend still hides the source-adapter work from users.
- Solution:
  Add a root harness layer (`AGENTS.md`, role docs, task docs, automated checks) and use that structure to deliver one concrete scoped feature: a source-driven analysis flow in the dashboard.

## Target Users

- Primary:
  Maintainers iterating on AI-Rookie with Codex
- Secondary:
  Demo users validating regulation-change analysis with sample or MCP-backed inputs

## Goals

- Make future Codex sessions start from an explicit planner-generator-evaluator workflow
- Add lightweight automation that blocks commits when harness files are missing
- Expose source-provider selection in the dashboard so the adapter architecture is usable
- Keep existing storage, pipeline, and deployed API behavior intact

## Non-Goals

- Rebuild the repo into a full OpenHarness runtime
- Connect to a real municipality DB in this task
- Fully redesign the product scope beyond youth/welfare regulation-change support

## Workstreams

1. Add a root `AGENTS.md` that orchestrates planner, generator, and evaluator behavior for this repo.
2. Add `agents/planner.md`, `agents/generator.md`, `agents/evaluator.md`, and `agents/evaluation_criteria.md` tailored to AI-Rookie.
3. Add task-state files `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, plus `output/README.md`.
4. Add `scripts/harness-check.js` and wire it into package scripts and pre-commit flow.
5. Document the harness workflow in repo-level docs.
6. Update backend request handling so source provider selection can be chosen per analyze request.
7. Update the dashboard to select between `local-fixture` and `korea-law-mcp`.
8. Show clear hints/status for source usage, including MCP before/after IDs when needed.
9. Keep history, smoke checks, tests, and handover aligned with the new workflow.

## File Touch Plan

- Harness:
  `AGENTS.md`, `agents/*`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, `output/README.md`
- Automation:
  `scripts/harness-check.js`, `.githooks/pre-commit`, `package.json`
- Product:
  `backend/src/http/app.js`, `index.html`, `frontend/index.html`, `frontend/src/app.js`, `frontend/src/styles.css`
- Docs and handover:
  `README.md`, `docs/11_progress_board.md`, `docs/09_handover_status.txt`, `docs/15_harness_workflow.md`

## Technical Requirements

- Preserve existing Node/Vercel runtime setup
- Do not break provider adapters or their tests
- Keep the harness files human-readable and lightweight
- Default dashboard flow must still work without MCP configuration
- When `korea-law-mcp` is selected, the frontend must send `beforeId` and `afterId`

## Validation Plan

- `npm run harness:check`
- `npm run test`
- `npm run eval`
- `npm run smoke` with a local server for HTTP/UI-related changes

## Acceptance Criteria

- Root harness files and role docs exist and match the actual repo workflow
- A missing harness file causes `npm run harness:check` to fail
- The dashboard can submit `source.provider=local-fixture`
- The dashboard can submit `source.provider=korea-law-mcp` with `beforeId` and `afterId`
- Backend uses the requested source provider for `/analyze`
- Existing automated checks pass after the refactor
- `SELF_CHECK.md`, `QA_REPORT.md`, and `docs/09_handover_status.txt` reflect the completed work
