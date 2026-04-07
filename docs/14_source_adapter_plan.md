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
  - 기본 tool contract: `get_ordinance_detail({ ID })`
  - tool name / ID argument name은 env로 override 가능

## Why this exists now
- 샘플 기반 데모를 유지하면서도 다음 단계의 외부 연동 비용을 낮추기 위해서입니다.
- `before/after` 직접 입력과 `source` 기반 입력을 공존시켜 데모와 실연동 경로를 분리합니다.

## Next Implementation Step
1. 실제 Korea-law-mcp 서버의 tool contract를 확인해 env 기본값과 파서를 좁힌다.
2. `beforeId` / `afterId` 외에 조례명, 시행일, 공포일 기반 lookup 전략을 추가한다.
3. 실제 지자체 사례 2~3건으로 smoke/demo 시나리오를 교체한다.
4. 프론트에 source provider 선택과 source ID 입력 UI를 붙인다.
