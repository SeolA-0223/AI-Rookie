# Evaluation Report

## Goal
Validate that the pipeline stays stable on both the default sample and the municipality-oriented case packs under `data/cases/*`.

## Run
```bash
npm run eval
```

The command prints the report JSON and writes the latest artifact to `data/eval/metrics.json`.

## Report Shape
- Top-level `metrics` and `checks`: default sample fixture results
- `caseSuite.summary`: aggregate result across all municipality case packs
- `caseSuite.cases[]`: per-case metrics, checks, and source metadata

## Metric Definitions
| Metric | Definition | Formula |
| --- | --- | --- |
| `changeDetection.precision` | Share of predicted clause changes that were actually changed | `truePositives / predictedChangedClauses` |
| `changeDetection.recall` | Share of actual clause changes that were detected | `truePositives / expectedChangedClauses` |
| `changeDetection.f1` | Harmonic mean of precision and recall | `2PR / (P + R)` |
| `mapping.coverageRate` | Share of changed rows linked to at least one impacted document | `rowsWithImpactedDocuments / rows` |
| `mapping.avgImpactedDocumentsPerChange` | Average impacted documents per change row | `sum(impactedDocuments) / rows` |
| `risk.highRiskRate` | Share of risk rows marked `빨강` | `count(빨강) / rows` |
| `traceability.completenessRate` | Share of traces with evidence, impacted docs, and risk | `completeTraces / traces` |
| `drafts.completenessRate` | Share of required draft sections that were generated | `generatedSections / requiredSections` |

## Latest Result Snapshot
Current `data/eval/metrics.json` reports:

- default sample `f1=1`, `mapping.coverageRate=1`, `traceability.completenessRate=1`, `drafts.completenessRate=1`
- `caseSuite.summary.evaluatedCaseCount=3`
- `caseSuite.summary.passedCaseCount=3`
- `caseSuite.summary.allCasesPassed=true`
- `caseSuite.summary.averageF1=1`
- `caseSuite.summary.averageMappingCoverage=1`

## Notes
- The municipality case packs are normalized demo excerpts, not verbatim ordinance text.
- The evaluation suite is useful for regression detection, but it is still synthetic until a real `korea-law-mcp` runtime is validated against live upstream responses.
