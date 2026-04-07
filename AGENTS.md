# AI-Rookie Harness

This repository uses a strict `Planner -> Generator -> Evaluator` workflow for non-trivial work.

## Required Files

- `agents/planner.md`
- `agents/generator.md`
- `agents/evaluator.md`
- `agents/evaluation_criteria.md`
- `SPEC.md`
- `SELF_CHECK.md`
- `QA_REPORT.md`
- `output/README.md`

If any required file is missing, restore it before continuing.

## Pipeline

1. Planner reads the user request plus relevant project docs and rewrites `SPEC.md`.
2. Generator reads `SPEC.md`, `agents/evaluation_criteria.md`, and prior `QA_REPORT.md`, then implements the scoped changes.
3. Generator updates `SELF_CHECK.md` with concrete validation evidence and open risks.
4. Evaluator reads the spec, rubric, changed files, and `SELF_CHECK.md`, then rewrites `QA_REPORT.md`.
5. If the verdict is `PASS`, stop.
6. If the verdict is `CONDITIONAL PASS` or `FAIL`, return to Generator and revise.
7. Run at most 3 generator-evaluator cycles per task.

## Repo Rules

- Keep the product scoped to municipality youth/welfare regulation-change support. Do not widen the product without updating the spec.
- Preserve source/storage provider boundaries. HTTP handlers and UI may select providers, but provider-specific logic stays in adapters.
- Treat `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, and `docs/09_handover_status.txt` as deliverable files, not optional notes.
- Validate with `npm run harness:check`, `npm run test`, `npm run eval`, and `npm run smoke` when HTTP or UI behavior changes.
- Do not relax acceptance criteria ad hoc. Tighten the harness when failures repeat.
