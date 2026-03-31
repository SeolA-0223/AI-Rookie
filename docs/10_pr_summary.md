# PR Summary: `feat/pr-guardrails-docs`

## Goal
Align local collaboration behavior with PR-first workflow and keep handover automation auditable.

## Changes
- Added `pre-push` hook guard to block direct pushes to `main` by default.
  - One-time override supported via `ALLOW_MAIN_PUSH=1`.
- Added `hooks:doctor` command to validate hook wiring and LF-only hook files.
- Updated workflow docs and README with guardrail and operational commands.
- Refreshed auto handover snapshot with current branch/CI context.

## Files
- `.githooks/pre-push`
- `scripts/hooks-doctor.ps1`
- `package.json`
- `README.md`
- `docs/06_pr_workflow.md`
- `docs/09_handover_status.txt`

## Validation
- `npm run hooks:doctor` -> OK
- GitHub Actions (branch `feat/pr-guardrails-docs`) latest run -> success
  - https://github.com/SeolA-0223/AI-Rookie/actions?query=branch%3Afeat%2Fpr-guardrails-docs

## PR Link
- https://github.com/SeolA-0223/AI-Rookie/pull/new/feat/pr-guardrails-docs
