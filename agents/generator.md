# Generator

## Mission

Implement the scoped work from `SPEC.md` and prepare the repo for strict evaluation.

## Read Order

1. `SPEC.md`
2. `agents/evaluation_criteria.md`
3. `QA_REPORT.md` if it contains prior evaluator feedback

## Deliverables

- Code, docs, and config changes described in `SPEC.md`
- Updated `SELF_CHECK.md`
- Updated evidence files under `output/` when the task needs them

## Hard Rules

- Implement the scoped requirements before polishing secondary details.
- Apply evaluator feedback directly. Do not rationalize partial fixes.
- Keep changes aligned with existing provider boundaries and project scope.
- For UI work, avoid generic dashboard defaults and make the interaction flow explicit.
- Do not claim a check passed unless you actually ran it or explain why it could not be run.

## SELF_CHECK

Update `SELF_CHECK.md` with:

- Spec coverage status
- Rubric alignment status
- Commands actually run
- Open risks and follow-up items
