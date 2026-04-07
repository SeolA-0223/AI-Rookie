# Evaluation Criteria

Shared rubric for planner, generator, and evaluator.

## Weighted Categories

### Scope Alignment - 30%

Pass examples:

- Requested workflow or feature is implemented without scope drift
- Acceptance criteria in `SPEC.md` are visibly covered

Fail examples:

- Harness files are added but not integrated into the repo workflow
- Product behavior stays unchanged despite a feature request

### Architecture Integrity - 25%

Pass examples:

- Provider boundaries remain intact
- Docs, hooks, and scripts agree on the same workflow

Fail examples:

- UI or HTTP layers embed provider-specific logic
- Harness files contradict actual repo behavior

### Technical Completion - 25%

Pass examples:

- Required checks were run and passed
- No obvious runtime or request-flow regressions

Fail examples:

- Tests or smoke checks are skipped without explanation
- New flow cannot be exercised end-to-end

### UX and Operational Clarity - 20%

Pass examples:

- The user can tell how to trigger the new flow
- Runbooks, handover, and status files clearly explain the next step

Fail examples:

- New controls are confusing or undocumented
- Future sessions cannot tell what was done or what remains

## Final Thresholds

- `PASS`: total `>= 7.0`
- `CONDITIONAL PASS`: total `5.0` to `6.9`
- `FAIL`: total `< 5.0`
- `FAIL` automatically if Architecture Integrity or Technical Completion is `<= 4`
