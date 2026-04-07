# Source Adapter Plan

## Goal
법령/조례 입력을 샘플 JSON에 고정하지 않고, 이후 `Korea-law-mcp` 같은 외부 소스에서 받아오도록 확장할 준비를 합니다.

## Current State
- `backend/src/sources/lawSource.js`
  - source provider factory
- `backend/src/sources/providers/localFixtureLawSource.js`
  - 샘플 전/후 문서 반환
- `backend/src/sources/providers/koreaLawMcpSource.js`
  - 환경변수와 adapter 자리만 확보
  - 실제 fetch 로직은 아직 미구현

## Why this exists now
- 샘플 기반 데모를 유지하면서도 다음 단계의 외부 연동 비용을 낮추기 위해서입니다.
- `before/after` 직접 입력과 `source` 기반 입력을 공존시켜 데모와 실연동 경로를 분리합니다.

## Next Implementation Step
1. Korea-law-mcp HTTP/transport contract 확정
2. `koreaLawMcpSource.js`에서 실제 비교용 before/after 문서 fetch 구현
3. 필요 시 법령 식별자, 조례명, 시행일 기준 request schema 확장
4. 실제 지자체 사례 2~3건으로 smoke/demo 시나리오 교체
