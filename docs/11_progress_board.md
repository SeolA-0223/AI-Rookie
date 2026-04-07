# 진행 보드 (Plan + Progress)

기준 시각: 2026-04-07 09:40 KST

## 한눈에 보기
| 구분 | 상태 | 내용 |
| --- | --- | --- |
| 배포 체인 | 완료 | GitHub -> Vercel -> Supabase 정상 동작 확인 |
| 분석 파이프라인 MVP | 완료 | 변경 탐지, 영향 매핑, 위험도 분류, 초안 생성, trace 제공 |
| 저장소 분리 | 완료 | `local` / `supabase` / `municipal` provider 구조 정리 |
| 법령 소스 분리 | 진행 중 | `local-fixture` / `korea-law-mcp` adapter 구조 정리, 실제 MCP fetch 미구현 |
| 제품 고도화 | 다음 작업 | 실제 지자체 사례 입력과 대시보드 개선 |

## 완료된 작업
- [x] `/analyze`, `/history`, `/health` API 배포 및 라이브 점검
- [x] GitHub Actions CI 정비 및 `v6` 업그레이드
- [x] Supabase 저장 계층 연결 및 Vercel 배포 확인
- [x] 저장소 provider 분리 (`local`, `supabase`, `municipal` placeholder)
- [x] 법령 소스 provider 분리 (`local-fixture`, `korea-law-mcp` placeholder)
- [x] 테스트/스모크 체크 갱신 (`npm run check`, `npm run smoke` 통과)

## 지금 진행 중
- [ ] `korea-law-mcp` 실제 transport contract 확정
- [ ] 실제 법령 source fetch 구현
- [ ] 제품 진행 문서를 현재 아키텍처 기준으로 지속 정리

## 다음 작업 (우선순위)
1. `korea-law-mcp` HTTP 또는 MCP transport 명세 확정
2. `backend/src/sources/providers/koreaLawMcpSource.js`에 실제 fetch 구현
3. 복지·청년지원 도메인 기준 실제 지자체 사례 2~3건 수집
4. `/analyze` 입력을 실제 조례/자치법규 식별자 기반으로 확장
5. 대시보드에서 `source` 기반 분석 실행 UI 추가
6. 평가셋을 샘플 1세트에서 다중 사례로 확장

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
