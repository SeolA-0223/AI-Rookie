# 진행 보드 (Plan + Progress)

기준 시각: 2026-04-07 11:05 KST

## 한눈에 보기
| 구분 | 상태 | 내용 |
| --- | --- | --- |
| 하네스 워크플로우 | 완료 | 루트 `AGENTS.md`, 역할 문서, task docs, `harness:check` 추가 |
| 배포 체인 | 완료 | GitHub -> Vercel -> Supabase 정상 동작 확인 |
| 분석 파이프라인 MVP | 완료 | 변경 탐지, 영향 매핑, 위험도 분류, 초안 생성, trace 제공 |
| 저장소 분리 | 완료 | `local` / `supabase` / `municipal` provider 구조 정리 |
| 법령 소스 분리 | 완료 | `local-fixture` / `korea-law-mcp` adapter 구조 + 실제 MCP HTTP fetch 구현 |
| 대시보드 source 입력 | 완료 | `local-fixture` / `korea-law-mcp` 선택 UI와 요청별 source provider 처리 |
| MCP 계약 정렬 | 완료 | 공개 `mcp-kr-legislation` README 기준 tool fallback 정렬 |
| Source Status API | 완료 | `/source-status`로 request-level provider 상태 조회 |
| 제품 고도화 | 다음 작업 | 실제 지자체 사례 입력과 실서버 MCP 검증 |

## 완료된 작업
- [x] `/analyze`, `/history`, `/health` API 배포 및 라이브 점검
- [x] GitHub Actions CI 정비 및 `v6` 업그레이드
- [x] Supabase 저장 계층 연결 및 Vercel 배포 확인
- [x] 저장소 provider 분리 (`local`, `supabase`, `municipal` placeholder)
- [x] 법령 소스 provider 분리 (`local-fixture`, `korea-law-mcp`)
- [x] `korea-law-mcp` Streamable HTTP transport 연동 + mock 서버 테스트 추가
- [x] 공개 `mcp-kr-legislation` README 기준 tool fallback 정렬 (`get_local_ordinance_detail` -> `get_ordinance_detail`)
- [x] `/source-status` 추가 및 대시보드 request-level source status 조회 연결
- [x] 루트 하네스 구조 추가 (`AGENTS.md`, `agents/*`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`)
- [x] `harness:check`와 pre-commit guard 추가
- [x] 대시보드 source 선택 UI 추가
- [x] 테스트/스모크 체크 갱신 (`npm run check`, `npm run smoke` 통과)

## 지금 진행 중
- [ ] 실제 Korea-law-mcp 서버의 live contract 확인
- [ ] 복지·청년지원 실제 지자체 사례 데이터 수집
- [ ] `search_local_ordinance` 기반 ID 검색 보조 흐름 설계

## 다음 작업 (우선순위)
1. 실제 Korea-law-mcp 서버의 live tool name / argument name / 응답 shape 확인
2. 복지·청년지원 도메인 기준 실제 지자체 사례 2~3건 수집
3. `/analyze` 입력을 실제 조례/자치법규 식별자 기반으로 정리
4. `search_local_ordinance` 기반 ID 검색 보조 흐름 추가
5. 평가셋을 샘플 1세트에서 다중 사례로 확장
6. 한국어 법령 텍스트 기준 변경유형 분류 규칙 보강

## 작업 루틴 (인수인계 기준)
1. 코드/문서 수정
2. `npm run check`
3. 필요 시 로컬 서버로 `npm run smoke`
4. 커밋 (pre-commit이 handover 자동 갱신)
5. 라이브 배포 확인이 필요하면 Vercel API 재점검

## 빠른 명령어
- 상태 확인: `git status --short --branch`
- 통합 점검: `npm run check`
- 스모크 테스트: `npm run smoke`
- 인수인계 수동 갱신: `npm run handover:update`
- 훅 점검: `npm run hooks:doctor`
