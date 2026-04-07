# 진행 보드 (Plan + Progress)

기준 시각: 2026-04-08 01:12 KST

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
| Source Search Helper | 완료 | `/source-search`와 대시보드 후보 선택으로 ID 탐색 보조 |
| Before/After 추천 | 완료 | 검색 결과의 동일 조례군과 날짜 메타데이터를 사용해 추천 pair 계산 |
| 실사례 케이스 팩 | 완료 | 울산/부천/서울 청년·복지 중심 normalized case pack 3종 추가 |
| 다중 사례 평가 | 완료 | `npm run eval`이 `data/cases/*` 전체를 평가하고 aggregate summary를 생성 |
| 제품 고도화 | 다음 작업 | live MCP 계약 검증과 다중 사례 평가 확장 |

## 완료된 작업
- [x] `/analyze`, `/history`, `/health` API 배포 및 라이브 점검
- [x] GitHub Actions CI 정비 및 `v6` 업그레이드
- [x] Supabase 저장 계층 연결 및 Vercel 배포 확인
- [x] 저장소 provider 분리 (`local`, `supabase`, `municipal` placeholder)
- [x] 법령 소스 provider 분리 (`local-fixture`, `korea-law-mcp`)
- [x] `korea-law-mcp` Streamable HTTP transport 연동 + mock 서버 테스트 추가
- [x] 공개 `mcp-kr-legislation` README 기준 tool fallback 정렬 (`get_local_ordinance_detail` -> `get_ordinance_detail`)
- [x] `/source-status` 추가 및 대시보드 request-level source status 조회 연결
- [x] `/source-search` 추가 및 `search_local_ordinance` 기반 ID 검색 보조 연결
- [x] `/source-search` 응답에 추천 `before` / `after` pair 추가
- [x] 대시보드에 `Use Recommended Pair` 흐름 추가
- [x] 지자체 실사례 기반 normalized case pack 3종 추가 (`울산`, `부천`, `서울`)
- [x] 기본 `local-fixture` 샘플을 울산 청년 구직지원 사례로 교체
- [x] 변경 탐지/영향 매핑 키워드를 새 샘플 기준으로 정리
- [x] `npm run eval`을 기본 샘플 + `data/cases/*` suite 평가로 확장
- [x] 루트 하네스 구조 추가 (`AGENTS.md`, `agents/*`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`)
- [x] `harness:check`와 pre-commit guard 추가
- [x] 대시보드 source 선택 UI 추가
- [x] 테스트/스모크 체크 갱신 (`npm run check`, `npm run smoke` 통과)

## 지금 진행 중
- [ ] 실제 Korea-law-mcp 서버의 live contract 확인
- [ ] 실제 MCP 서버 기동 검증용 Python/uv 실행 환경 확보

## 다음 작업 (우선순위)
1. 실제 Korea-law-mcp 서버의 live tool name / argument name / 응답 shape 확인
2. `/analyze` 입력을 실제 조례/자치법규 식별자 기반으로 정리
3. 한국어 법령 텍스트 기준 변경유형 분류 규칙 보강
4. 케이스 팩 전환 UI 또는 CLI 보조 흐름 추가
5. 실제 MCP 서버 응답을 기준으로 recommendation heuristic 보정
6. live MCP 검증 이후 source-search ranking 회귀 테스트 강화

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
