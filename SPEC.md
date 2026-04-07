# SPEC

## Request Summary

Continue the post-search-recommendation work by extending `npm run eval` from a single default sample to a multi-case municipality suite, while preserving the existing top-level sample report and leaving clear next steps for live MCP verification.

## CPS

- Context:
  AI-Rookie already supports municipality case packs and a recommendation-based ordinance search workflow.
- Problem:
  Evaluation still centered on a single default sample, so regression signals were too narrow for the growing municipality case-pack library.
- Solution:
  Refactor the evaluation script so it keeps the legacy default-sample metrics but also evaluates every municipality case pack under `data/cases/*` and writes both per-case and aggregate results into `data/eval/metrics.json`.

## Target Users

- Primary:
  Maintainers iterating on AI-Rookie with Codex
- Secondary:
  Maintainers who need broader regression coverage before touching live ordinance inputs

## Goals

- Add 3 municipality-oriented normalized case packs under `data/cases`
- Extend `npm run eval` to evaluate all municipality case packs
- Preserve the existing top-level default sample metrics for backward compatibility
- Add aggregate suite summary and per-case results to `data/eval/metrics.json`
- Keep current tests and runtime flows stable
- Update docs, harness files, progress tracking, and handover for the next session

## Non-Goals

- Prove a public live `korea-law-mcp` deployment in this task
- Install Python/uv in this workspace just to validate the upstream server
- Replace the current analysis pipeline or storage flow

## Workstreams

1. Refactor `scripts/evaluate.js` into reusable dataset/suite helpers.
2. Add a multi-case suite over `data/cases/*`.
3. Keep top-level default sample metrics and append suite summary/cases.
4. Add tests for the evaluation helpers.
5. Update docs, progress tracking, and handover.

## File Touch Plan

- Backend:
  `scripts/evaluate.js`
- Tests:
  `tests/evaluate.test.js`
- Docs and task state:
  `README.md`, `docs/03_eval_report.md`, `docs/07_local_run.md`, `docs/11_progress_board.md`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, `docs/09_handover_status.txt`

## Technical Requirements

- Preserve the existing Node/Vercel runtime setup and request-level source workflow
- Keep the top-level `metrics` / `checks` shape usable for existing consumers
- Suite evaluation must cover every directory under `data/cases/*`
- Current tests and `npm run check` must continue to pass

## Validation Plan

- `npm run test`
- `npm run check`
- `npm run smoke` with a local server

## Acceptance Criteria

- `npm run eval` writes a `caseSuite.summary` and `caseSuite.cases[]`
- `caseSuite.summary.evaluatedCaseCount` matches the number of municipality case-pack directories
- Top-level sample report still exists
- `npm run test`, `npm run check`, and local `npm run smoke` pass
- README, eval report, local-run guide, progress board, and handover reflect the suite workflow
