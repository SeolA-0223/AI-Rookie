# Harness Workflow

## Why this exists

이 저장소는 `Harness Engineering` 기준에 맞춰 `Planner -> Generator -> Evaluator` 작업 루프를 강제합니다.

핵심 목적:

- 세션마다 같은 출발점을 제공
- 결과물뿐 아니라 작업 방식도 재현 가능하게 유지
- 실패가 반복되면 프롬프트가 아니라 하네스를 고치도록 유도

## Root Files

- `AGENTS.md`
  - 루트 오케스트레이터
- `agents/planner.md`
  - 요청을 `SPEC.md`로 확장
- `agents/generator.md`
  - 코드/문서 구현과 `SELF_CHECK.md` 갱신
- `agents/evaluator.md`
  - 결과 검수와 `QA_REPORT.md` 갱신
- `agents/evaluation_criteria.md`
  - 공통 채점표
- `SPEC.md`
  - 현재 작업 범위와 acceptance criteria
- `SELF_CHECK.md`
  - 실제 실행한 검증과 오픈 리스크
- `QA_REPORT.md`
  - 최종 평가

## Automation

- `npm run harness:check`
  - 필수 하네스 파일 존재와 기본 구조 확인
- `.githooks/pre-commit`
  - `harness:check` 실행
  - `docs/09_handover_status.txt` 자동 갱신
  - `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md` 자동 스테이징

## Current Mapping

- Planner 결과:
  - `SPEC.md`
- Generator 결과:
  - 실제 코드/문서 변경
  - `SELF_CHECK.md`
- Evaluator 결과:
  - `QA_REPORT.md`
- 지속 작업 인수인계:
  - `docs/09_handover_status.txt`

## Working Rule

1. 작업 시작 전에 `SPEC.md`를 현재 요청 기준으로 갱신
2. 구현 후 `SELF_CHECK.md`에 실제 실행한 검증 기록
3. 평가 후 `QA_REPORT.md`에 점수와 수정 필요사항 반영
4. 커밋 전 `npm run check`
5. HTTP나 UI가 바뀌면 로컬 서버로 `npm run smoke`
