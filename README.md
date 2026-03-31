# AI-Rookie

규정 변경 누락 방지 MVP 저장소입니다.

## 구조
- `backend`: 변경 탐지, 영향 매핑, 위험도 분류, 초안 생성 API
- `frontend`: 대시보드 UI 샘플
- `shared`: API 계약
- `data/samples`: 샘플 데이터
- `docs`: 기획/설계 문서
- `tests`: Node 테스트

## 실행
1. 의존성 설치
   - `npm install`
2. API 서버 실행
   - `npm run start`
3. 스모크 체크
   - `npm run smoke`

`/analyze`는 body가 없어도 샘플 데이터를 사용해 결과를 반환합니다.

## 테스트/점검
- `npm run test`
- `npm run eval`
- `npm run check`
- 평가 산출물: `data/eval/metrics.json`

## 자동 인수인계
- 인수인계 파일: `docs/09_handover_status.txt`
- 수동 갱신: `npm run handover:update`
- Git 훅 설치(1회): `npm run hooks:install`
  - 훅 상태 점검: `npm run hooks:doctor`
  - 설치 후 커밋할 때마다 pre-commit 훅이 인수인계 파일을 자동 갱신/스테이징합니다.
  - pre-push 훅이 `main` 직접 푸시를 기본 차단합니다(기능 브랜치 + PR 유도).
  - `main` 푸시 1회 예외 허용: ``$env:ALLOW_MAIN_PUSH=1; git push origin main``
  - 훅 일시 비활성화(PowerShell): ``$env:SKIP_HANDOVER_HOOK=1; git commit ...``

## 협업
- 로컬 실행 가이드: `docs/07_local_run.md`
- 평가 리포트: `docs/03_eval_report.md`
- 데모 스크립트: `docs/04_demo_script.md`
- PR 기반 흐름: `docs/06_pr_workflow.md`
