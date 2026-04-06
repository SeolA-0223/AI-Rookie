# Release Notes (Draft)

## Release
- Date: 2026-03-31
- Commit: `e91c062`
- Branches:
  - `main`
  - `feat/review-20260331-1628`

## Summary
이번 릴리즈는 병렬 작업트리에서 진행된 핵심 기능을 메인 코드베이스로 통합하고, 실행/검증/평가 흐름을 일관되게 정리한 통합 릴리즈입니다.

## Included Changes
- Backend hardening
  - `/analyze` 요청 JSON/필드/크기(1MB) 검증
  - 표준 에러 응답 포맷(`code`, `message`, `details`) 적용
  - 파이프라인 입력 유효성 검사 추가
- Pipeline response compatibility
  - 신규 `meta`, `analysis` 필드 추가
  - 기존 클라이언트 호환을 위한 레거시 top-level 필드(`changes`, `mapped`, `risks`, `traces`) 유지
- Frontend live API integration
  - 대시보드에서 실시간 `/analyze` 호출
  - 로딩/성공/실패 상태 표시
  - 구/신 응답 스키마 동시 처리
- Supabase persistence
  - `GET /history` 추가
  - 선택적 Supabase 저장 계층 추가 (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
  - Supabase CLI 초기화 및 `analysis_runs` 마이그레이션 추가
- DevEx / Evaluation
  - `npm run test`, `npm run eval`, `npm run smoke`, `npm run check` 스크립트 정리
  - CI에서 `npm run check` 실행
  - 평가 스크립트(`scripts/evaluate.js`) 및 산출물(`data/eval/metrics.json`) 추가
  - 로컬 실행/평가/데모 문서 추가
- API contract
  - OpenAPI 문서 확장(요청/응답/에러 스키마 반영)

## Validation
- `npm run test`: pass (7/7)
- `npm run eval`: pass (metrics generated)
- `npm run check`: pass
- `npm run smoke`: pass (`/health`, `/analyze`)

## PR
- Create PR URL:
  - https://github.com/SeolA-0223/AI-Rookie/pull/new/feat/review-20260331-1628
