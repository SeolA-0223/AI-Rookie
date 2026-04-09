# 진행 보드 (Plan + Progress)

기준 시각: 2026-04-10 00:14 KST

## 한눈에 보기
| 구분 | 상태 | 내용 |
| --- | --- | --- |
| 하네스 워크플로우 | 완료 | 루트 `AGENTS.md`, 역할 문서, task docs, `harness:check` 추가 |
| 배포 체인 | 완료 | GitHub -> Vercel -> Supabase 정상 동작 확인 |
| 분석 파이프라인 MVP | 완료 | 변경 탐지, 영향 매핑, 위험도 분류, 초안 생성, trace 제공 |
| 저장소 분리 | 완료 | `local` / `supabase` / `municipal` provider 구조 정리 |
| 법령 소스 분리 | 완료 | `local-fixture` / `law-go-public` / `korea-law-mcp` adapter 구조 정리 |
| 대시보드 source 입력 | 완료 | `local-fixture` / `law-go-public` / `korea-law-mcp` 선택 UI와 요청별 source provider 처리 |
| MCP 계약 정렬 | 완료 | 공개 `mcp-kr-legislation` README 기준 tool fallback 정렬 |
| Source Status API | 완료 | `/source-status`로 request-level provider 상태 조회 |
| Source Search Helper | 완료 | `/source-search`와 대시보드 후보 선택으로 ID 탐색 보조 |
| Before/After 추천 | 완료 | 검색 결과의 동일 조례군과 날짜 메타데이터를 사용해 추천 pair 계산 |
| 실사례 케이스 팩 | 완료 | 울산/부천/서울 청년·복지 중심 normalized case pack 3종 추가 |
| 케이스 카탈로그 | 완료 | `/case-catalog` + 대시보드 dropdown으로 bundled case pack 선택 |
| 다중 사례 평가 | 완료 | `npm run eval`이 `data/cases/*` 전체를 평가하고 aggregate summary를 생성 |
| 공식 법령 공개 연동 | 완료 | `law.go.kr` 공개 검색 + 본문 print endpoint + 연혁(`ordinHstListR.do`) + HTML search fallback 정리 |
| 제품 고도화 | 다음 작업 | 실 OC 확보, live MCP 계약 검증, Vercel 외부 백엔드 런타임 검토 |

## 완료된 작업
- [x] `/analyze`, `/history`, `/health` API 배포 및 라이브 점검
- [x] GitHub Actions CI 정비 및 `v6` 업그레이드
- [x] Supabase 저장 계층 연결 및 Vercel 배포 확인
- [x] 저장소 provider 분리 (`local`, `supabase`, `municipal` placeholder)
- [x] 법령 소스 provider 분리 (`local-fixture`, `law-go-public`, `korea-law-mcp`)
- [x] `korea-law-mcp` Streamable HTTP transport 연동 + mock 서버 테스트 추가
- [x] 공개 `mcp-kr-legislation` README 기준 tool fallback 정렬 (`get_local_ordinance_detail` -> `get_ordinance_detail`)
- [x] `law-go-public` provider 추가 및 공식 `law.go.kr` 공개 검색/본문 endpoint 정규화
- [x] 실제 `law.go.kr` 실서버에서 조문 본문 fetch 검증 (`ordinBdyPrint.do`)
- [x] `law-go-public` 검색 결과에 `ordinHstListR.do` 연혁 확장을 붙여 추천 pair 보강
- [x] `/source-status` 추가 및 대시보드 request-level source status 조회 연결
- [x] `/source-search` 추가 및 `search_local_ordinance` 기반 ID 검색 보조 연결
- [x] `/source-search` 응답에 추천 `before` / `after` pair 추가
- [x] 대시보드에 `Use Recommended Pair` 흐름 추가
- [x] 지자체 실사례 기반 normalized case pack 3종 추가 (`울산`, `부천`, `서울`)
- [x] `/case-catalog` 추가 및 `local-fixture caseId` 기반 bundled case pack 선택 지원
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
- [ ] 실사용 `LAW_GO_OC` 또는 동등한 검색 자격 확보
- [ ] Vercel serverless 런타임에서는 `law.go.kr` outbound가 `ECONNRESET`로 끊기는 제한 정리

## 다음 작업 (우선순위)
1. 실사용 `LAW_GO_OC`를 확보하거나 검색을 대체할 live Korea-law-mcp 런타임 확보
2. `law-go-public`를 계속 쓸 경우 Vercel 밖의 실행 환경으로 백엔드 이전
3. 실제 Korea-law-mcp 서버의 live tool name / argument name / 응답 shape 확인
4. `/analyze` 입력을 실제 조례/자치법규 식별자 기반으로 더 정리
5. 한국어 법령 텍스트 기준 변경유형 분류 규칙 보강
6. 케이스 팩 선택 결과를 히스토리/화면 상단에 더 선명하게 표시

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
