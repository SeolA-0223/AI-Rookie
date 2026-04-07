# SPEC

## Request Summary

Continue the Korea-law MCP and product-direction work by replacing the single generic sample with 2 to 3 municipality youth/welfare-oriented case packs, keeping the runtime stable, and leaving the repository ready for the next live-contract and recommendation steps.

## CPS

- Context:
  AI-Rookie already supports provider-based storage, provider-based law sources, request-level source status/search, and a harness workflow.
- Problem:
  The demo still leaned on one generic sample pair, so it did not reflect the narrow municipality youth/welfare focus described in the project planning material.
- Solution:
  Add a small catalog of normalized municipality case packs grounded in official ordinance pages, switch the default sample to one of those cases, and align change-detection keywords so the pipeline remains stable on the new dataset.

## Target Users

- Primary:
  Maintainers iterating on AI-Rookie with Codex
- Secondary:
  Demo users who need municipality-oriented youth/welfare scenarios instead of a generic sample

## Goals

- Add 3 municipality-oriented normalized case packs under `data/cases`
- Switch the default `data/samples/*` fixture set to the Ulsan youth job-support case
- Keep change detection and impact mapping stable on the new dataset
- Update docs, harness files, progress tracking, and handover for the next session

## Non-Goals

- Prove a public live `korea-law-mcp` deployment in this task
- Build a full case-switching UI for all case packs
- Replace the current analysis pipeline or storage flow

## Workstreams

1. Collect 2 to 3 municipality youth/welfare cases from official ordinance pages and record metadata.
2. Add normalized demo case-pack files (`meta`, `before`, `after`, `internal_docs`) under `data/cases`.
3. Update the default sample fixture set to mirror the primary Ulsan case.
4. Tighten change-detection and impact-mapping keywords so the new sample still produces the expected 4 change types.
5. Update docs, harness state files, progress board, and handover.

## File Touch Plan

- Backend:
  `backend/src/changeDetection/detectChanges.js`, `backend/src/mapping/mapImpactDocuments.js`
- Data:
  `data/cases/**`, `data/samples/regulation_before.json`, `data/samples/regulation_after.json`, `data/samples/internal_docs.json`
- Docs and task state:
  `README.md`, `docs/07_local_run.md`, `docs/11_progress_board.md`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, `docs/09_handover_status.txt`

## Technical Requirements

- Preserve the existing Node/Vercel runtime setup and request-level source workflow
- Keep the default sample set compatible with current unit tests and `npm run eval`
- Use official ordinance metadata for dates, ordinance numbers, and source URLs
- Keep the normalized clause text explicit about being demo excerpts, not verbatim statutory text

## Validation Plan

- `npm run test`
- `npm run check`
- `npm run smoke` with a local server

## Acceptance Criteria

- `data/cases` contains 3 municipality-oriented case packs with official metadata
- `data/samples/*` mirrors the primary case pack and still produces the expected 4 change types
- `npm run test`, `npm run check`, and local `npm run smoke` pass
- README, local-run guide, progress board, and handover reflect the case-pack workflow
