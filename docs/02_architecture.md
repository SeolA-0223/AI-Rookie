# Architecture

## Core Pipeline
입력 -> 파싱 -> 조문 분리 -> 변경 탐지 -> 영향 매핑 -> 위험도 분류 -> 초안 생성 -> 근거 트레이스

## Runtime Layers
- `frontend`: 대시보드와 결과 확인 UI
- `backend/src/http`: `/health`, `/analyze`, `/history` API
- `backend/src/pipeline`: 도메인 분석 로직
- `backend/src/persistence`: 저장소 provider factory
- `backend/src/sources`: 법령 입력 source provider factory

## Provider Boundaries
- Storage provider
  - `local`
  - `supabase`
  - `municipal` placeholder
- Law source provider
  - `local-fixture`
  - `korea-law-mcp` via Streamable HTTP MCP

## Design Intent
- 분석 파이프라인은 저장 방식과 법령 수집 방식을 몰라야 한다.
- API는 provider factory만 호출하고 구현 세부사항을 직접 import하지 않는다.
- Korea-law-mcp tool name이나 ID argument name이 달라도 env 설정만 바꿔 adapter를 재사용할 수 있어야 한다.
- 향후 지자체 DB를 붙일 때는 storage adapter만 추가/교체하는 방향으로 확장한다.
