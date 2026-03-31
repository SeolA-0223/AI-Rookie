# 3-Minute Demo Script

## Demo Goal
규정 변경이 들어왔을 때, 변경 탐지부터 근거 추적/초안 생성까지 한 번에 확인되는 흐름을 3분 내 시연합니다.

## Pre-demo Setup
- 터미널 1: `npm start`
- 터미널 2: `npm run eval`
- 브라우저 또는 API 클라이언트 준비: `POST /analyze`

## Narrative (3:00)

### 0:00 - 0:30 Problem Context
말하기:
"정책 문서가 개정되면 요건, 서류, 기한, 금액 변경이 동시에 발생합니다. 사람이 수동으로 확인하면 누락이 생기기 쉬워서 민원과 재작업이 늘어납니다."

화면:
- `docs/01_mvp_scope.md`를 짧게 보여주고 변경 유형 4가지를 강조합니다.

### 0:30 - 1:20 Pipeline Run
말하기:
"이제 샘플 개정 전/후 문서를 넣어 파이프라인을 실행합니다. 시스템은 변경 조항을 찾고, 영향 문서를 매핑하고, 위험도를 분류합니다."

화면:
- `POST /analyze` 실행 결과에서 `changes`, `mapped`, `risks` 섹션을 순서대로 보여줍니다.
- `changes`에서 4건 탐지와 유형 분류를 강조합니다.

### 1:20 - 2:10 Trace and Draft Outputs
말하기:
"각 변경 건은 어떤 문서가 영향을 받는지와 함께 근거 trace를 남깁니다. 동시에 내부공지/시민안내/FAQ 초안을 자동으로 만듭니다."

화면:
- 응답의 `traces` 1건을 열어 `before`, `after`, `impactedDocumentIds`, `risk`를 짚습니다.
- `drafts`에서 `internalNoticeDraft`와 `comparisonTable`을 보여줍니다.

### 2:10 - 2:50 Evaluation Metrics
말하기:
"마지막으로 평가 스크립트로 품질 지표를 확인합니다. 샘플 데이터 기준으로 변경 탐지 precision/recall이 1.0이고, trace/draft 완결성도 1.0입니다."

화면:
- `npm run eval` 출력 JSON에서 `changeDetection`, `traceability`, `drafts`를 확대해서 보여줍니다.
- `data/eval/metrics.json` 파일 생성도 확인합니다.

### 2:50 - 3:00 Closing
말하기:
"요약하면, 개정 문서 입력 후 1회 실행으로 변경 탐지, 영향 분석, 위험 판단, 안내 초안 작성까지 연결됩니다. 다음 단계는 다중 지자체 데이터셋으로 평가 자동화를 확장하는 것입니다."
