# SELF_CHECK

- [x] `SPEC.md` requirements are implemented
- [x] Shared rubric was read before implementation
- [x] Korea-law MCP search helper is exposed through backend and dashboard
- [x] Commands run are listed below
- [x] Open risks are listed below

## Commands Run

- `npm run test`
- `npm run smoke` with a local server on port `3100`
- `npm run check`

## Open Risks

- A public live `korea-law-mcp` deployment endpoint is still not verified; the search contract is grounded in the public README plus local/mock integration tests.
- The search helper currently finds candidate IDs, but it does not yet recommend which result should be used as `before` versus `after`.
