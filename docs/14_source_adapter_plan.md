# Source Adapter Plan

## Goal
법령/조례 입력을 샘플 JSON에 고정하지 않고, 이후 `Korea-law-mcp` 같은 외부 소스에서 받아오도록 확장할 준비를 합니다.

## Current State
- `backend/src/sources/lawSource.js`
  - source provider factory
- `backend/src/sources/providers/localFixtureLawSource.js`
  - 샘플 전/후 문서 반환
- `backend/src/sources/providers/koreaLawMcpSource.js`
  - Streamable HTTP MCP client 연결
  - 공개 README 기준 `get_local_ordinance_detail({ ID })` 우선 사용
  - `get_ordinance_detail({ ID })` fallback 지원
  - `search_local_ordinance({ query })` 기반 검색 보조 지원
  - tool name / ID/search argument name은 env로 override 가능
- `GET /source-status`
  - request-selected provider 상태 반환
  - 대시보드가 선택한 provider 기준으로 설정 상태를 직접 조회
- `GET /source-search`
  - request-selected provider 기준 조례 후보 검색
  - 대시보드에서 `Before` / `After` ID 채우기 보조

## Why this exists now
- 샘플 기반 데모를 유지하면서도 다음 단계의 외부 연동 비용을 낮추기 위해서입니다.
- `before/after` 직접 입력과 `source` 기반 입력을 공존시켜 데모와 실연동 경로를 분리합니다.

## Next Implementation Step
1. 실제 Korea-law-mcp 서버에 붙여 live contract와 README contract가 일치하는지 확인한다.
2. `beforeId` / `afterId` 외에 조례명, 시행일, 공포일 기반 lookup 전략을 추가한다.
3. 실제 지자체 사례 2~3건으로 smoke/demo 시나리오를 교체한다.
4. 검색 결과에서 버전/시행일 기준으로 `before` / `after` 추천 규칙을 추가한다.
