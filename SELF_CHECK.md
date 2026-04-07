# SELF_CHECK

- [x] `SPEC.md` requirements are implemented
- [x] Shared rubric was read before implementation
- [x] `/source-search` now returns a recommendation when a plausible timeline pair exists
- [x] The dashboard can apply a recommended pair into `Before ID` / `After ID`
- [x] Existing source/analyze/history flows still pass after the recommendation change
- [x] Commands run are listed below
- [x] Open risks are listed below

## Commands Run

- `npm run test`
- `npm run check`
- `npm run start` in a background process on port `3101`
- `npm run smoke` with `BASE_URL=http://127.0.0.1:3101`

## Open Risks

- A public live `korea-law-mcp` deployment endpoint is still not verified; public README evidence exists, but no reachable HTTP deployment was found and this workspace does not currently have a usable Python/uv runtime to launch the upstream server locally.
- The recommendation heuristic is still based on title/jurisdiction/date metadata rather than real observed production responses from a live MCP server.
- The evaluation set is still single-sample at runtime because `npm run eval` reads `data/samples/*`; multi-case evaluation has not been added yet.
