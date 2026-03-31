# Evaluation Report

## Goal
샘플 정책 데이터 기준으로 파이프라인 품질을 정량 확인합니다.

## Run
```bash
npm run eval
```

실행 시 콘솔에 metrics JSON이 출력되고, `data/eval/metrics.json` 파일이 생성됩니다.

## Metric Definitions
| Metric | Definition | Formula |
|---|---|---|
| `changeDetection.precision` | 탐지된 변경 중 실제 변경 비율 | `truePositives / predictedChangedClauses` |
| `changeDetection.recall` | 실제 변경 중 탐지된 비율 | `truePositives / expectedChangedClauses` |
| `changeDetection.f1` | Precision/Recall 조화 평균 | `2PR / (P + R)` |
| `mapping.coverageRate` | 변경 건 중 영향 문서가 1개 이상 연결된 비율 | `rowsWithImpactedDocuments / rows` |
| `mapping.avgImpactedDocumentsPerChange` | 변경 건당 평균 연결 문서 수 | `sum(impactedDocuments) / rows` |
| `risk.highRiskRate` | 전체 위험도 중 빨강 비율 | `count(빨강) / rows` |
| `traceability.completenessRate` | 근거, 문서 연결, 위험도 정보가 모두 있는 trace 비율 | `completeTraces / traces` |
| `drafts.completenessRate` | 필수 초안 섹션 생성 비율 | `generatedSections / requiredSections` |

## Sample Results
아래 값은 샘플 데이터(`regulation_before/after`, `internal_docs`)를 기준으로 `npm run eval` 실행 시 생성됩니다.

```json
{
  "metrics": {
    "changeDetection": {
      "expectedChangedClauses": 4,
      "predictedChangedClauses": 4,
      "truePositives": 4,
      "precision": 1,
      "recall": 1,
      "f1": 1
    },
    "mapping": {
      "rows": 4,
      "rowsWithImpactedDocuments": 4,
      "coverageRate": 1,
      "avgImpactedDocumentsPerChange": 2.75
    },
    "risk": {
      "rows": 4,
      "distribution": {
        "빨강": 2,
        "노랑": 1,
        "파랑": 1
      },
      "highRiskRate": 0.5
    },
    "traceability": {
      "traces": 4,
      "completeTraces": 4,
      "completenessRate": 1
    },
    "drafts": {
      "requiredSections": 4,
      "generatedSections": 4,
      "completenessRate": 1
    }
  },
  "checks": {
    "noMissingChanges": true,
    "noMissingMappings": true,
    "allTracesComplete": true,
    "allDraftSectionsGenerated": true
  }
}
```

## Notes
- 현재 평가는 샘플 데이터 1세트 기준입니다.
- 실제 운영 전에는 지역/정책별 다중 평가셋으로 확대해 회귀 감시 지표로 사용해야 합니다.
