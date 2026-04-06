# 진행 보드 (Plan + Progress)

기준 시각: 2026-03-31 18:55 KST

## 한눈에 보기
| 구분 | 상태 | 내용 |
| --- | --- | --- |
| 브랜치 운영 | 완료 | `main` 직접 푸시 차단 + 기능 브랜치 PR 흐름 적용 |
| 인수인계 자동화 | 완료 | `pre-commit`에서 `docs/09_handover_status.txt` 자동 갱신/스테이징 |
| 훅 상태 점검 | 완료 | `npm run hooks:doctor`로 훅 설치 상태 확인 가능 |
| 문서 정리 | 진행 중 | PR 생성/병합 전 최종 요약 유지 |
| PR 처리 | 다음 작업 | PR 생성 -> 리뷰 -> CI 확인 -> 병합 |

## 완료된 작업
- [x] `.githooks/pre-push` 추가 (`main` 직접 푸시 기본 차단)
- [x] `scripts/hooks-doctor.ps1` 추가
- [x] `package.json`에 `hooks:doctor` 스크립트 연결
- [x] PR 워크플로우/템플릿/README 문서 최신화
- [x] 인수인계 자동 갱신 루틴 유지 (`npm run handover:update`)

## 지금 진행 중
- [ ] 기능 브랜치 기준 PR 최종 생성/리뷰 요청
- [ ] 병합 전 마지막 handover 스냅샷 확인 (`docs/09_handover_status.txt`)

## 다음 작업 (우선순위)
1. `feat/pr-guardrails-docs` 기준 PR 생성 및 리뷰 요청
2. CI 성공 상태 확인 후 병합
3. 병합 직후 `main` 기준으로 handover 스냅샷 1회 갱신
4. 필요 시 `docs/08_release_notes.md`에 최종 변경점 반영

## 작업 루틴 (인수인계 기준)
1. 코드/문서 수정
2. `npm run check`
3. 커밋 (pre-commit이 handover 자동 갱신)
4. 필요 시 `npm run hooks:doctor`
5. 기능 브랜치 푸시 -> PR -> CI 확인

## 빠른 명령어
- 상태 확인: `git status --short --branch`
- 통합 점검: `npm run check`
- 스모크 테스트: `npm run smoke`
- 인수인계 수동 갱신: `npm run handover:update`
- 훅 점검: `npm run hooks:doctor`
