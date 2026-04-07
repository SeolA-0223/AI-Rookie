# AI-Rookie

규정 변경 누락 방지 MVP 저장소입니다.

## 구조
- `backend`: 변경 탐지, 영향 매핑, 위험도 분류, 초안 생성 API
- `frontend`: 대시보드 UI 샘플
- `shared`: API 계약
- `data/samples`: 샘플 데이터
- `docs`: 기획/설계 문서
- `tests`: Node 테스트
- `agents`, `AGENTS.md`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`: Codex 하네스 운영 파일

## 실행
1. 의존성 설치
   - `npm install`
2. API 서버 실행
   - `npm run start`
3. 스모크 체크
   - `npm run smoke`

`/analyze`는 body가 없어도 샘플 데이터를 사용해 결과를 반환합니다.
`/history`는 현재 설정된 저장소 provider의 최근 분석 이력을 반환합니다.
`/source-status?provider=...`는 요청 시점에 선택한 law source provider의 설정 상태를 반환합니다.

## 저장소 provider
- 기본값은 `local`이며 외부 DB 없이 API를 실행할 수 있습니다.
- `STORAGE_PROVIDER=supabase`로 설정하면 Supabase에 분석 이력을 저장합니다.
- `STORAGE_PROVIDER=municipal`은 향후 지자체 DB 어댑터를 붙이기 위한 자리만 마련되어 있습니다.
- `STORAGE_PROVIDER`를 비워두고 `SUPABASE_URL`이 있으면 기존 배포와 호환되도록 `supabase`를 자동 선택합니다.

## 법령 소스 provider
- 기본값은 `local-fixture`이며 샘플 전/후 규정 문서를 사용합니다.
- `/analyze`는 기존처럼 `before`/`after` 직접 입력도 받을 수 있습니다.
- `LAW_SOURCE_PROVIDER=korea-law-mcp`를 쓰면 Streamable HTTP MCP endpoint에서 전/후 문서를 가져옵니다.
- 공개 `mcp-kr-legislation` README 기준 현재 기본 자치법규 상세 도구는 `get_local_ordinance_detail`이며, AI-Rookie는 `get_ordinance_detail`까지 자동 fallback 합니다.
- 기본 ID 인자는 `ID`입니다.
- 실제 서버 구현이 다르면 `KOREA_LAW_MCP_DETAIL_TOOL_NAME`, `KOREA_LAW_MCP_ID_ARGUMENT_NAME`으로 맞출 수 있습니다.
- 대시보드에서도 `Local Fixture`와 `Korea Law MCP`를 선택할 수 있으며, MCP를 고르면 `beforeId` / `afterId`를 직접 입력합니다.
- 대시보드는 `/api/source-status?provider=...`를 호출해 선택한 provider의 request-level 상태를 직접 확인합니다.

## 테스트/점검
- `npm run harness:check`
- `npm run test`
- `npm run eval`
- `npm run check`
- 평가 산출물: `data/eval/metrics.json`

## 하네스 워크플로우
- 루트 `AGENTS.md`가 `Planner -> Generator -> Evaluator` 흐름을 정의합니다.
- `SPEC.md`는 현재 작업 범위와 검증 기준을 고정합니다.
- `SELF_CHECK.md`는 실제 실행한 검증과 남은 리스크를 적습니다.
- `QA_REPORT.md`는 최종 평가와 다음 수정 포인트를 남깁니다.
- 자동 점검: `npm run harness:check`

## 자동 인수인계
- 인수인계 파일: `docs/09_handover_status.txt`
- 수동 갱신: `npm run handover:update`
- Git 훅 설치(1회): `npm run hooks:install`
  - 훅 상태 점검: `npm run hooks:doctor`
  - 설치 후 커밋할 때마다 pre-commit 훅이 하네스 파일 존재 여부를 검사하고 인수인계 파일을 자동 갱신/스테이징합니다.
  - pre-push 훅이 `main` 직접 푸시를 기본 차단합니다(기능 브랜치 + PR 유도).
  - `main` 푸시 1회 예외 허용: ``$env:ALLOW_MAIN_PUSH=1; git push origin main``
  - 훅 일시 비활성화(PowerShell): ``$env:SKIP_HANDOVER_HOOK=1; git commit ...``

## 협업
- 로컬 실행 가이드: `docs/07_local_run.md`
- 평가 리포트: `docs/03_eval_report.md`
- 데모 스크립트: `docs/04_demo_script.md`
- PR 기반 흐름: `docs/06_pr_workflow.md`
- 진행 보드(계획+현황): `docs/11_progress_board.md`
- Supabase 연동 가이드: `docs/12_supabase_setup.md`
- Vercel 배포 가이드: `docs/13_vercel_deploy.md`
- Source adapter 계획: `docs/14_source_adapter_plan.md`
- Harness workflow: `docs/15_harness_workflow.md`
