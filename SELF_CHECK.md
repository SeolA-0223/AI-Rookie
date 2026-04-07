# SELF_CHECK

- [x] `SPEC.md` requirements are implemented
- [x] Shared rubric was read before implementation
- [x] Request-level source status is exposed through backend and dashboard
- [x] Commands run are listed below
- [x] Open risks are listed below

## Commands Run

- `npm run test`
- `npm run smoke` with a local server on port `3100`
- `npm run check`

## Open Risks

- A public live `korea-law-mcp` deployment endpoint is still not verified; current confidence is based on the public README plus local/mock integration coverage.
- The ordinance detail parameter `ID` is still inferred from public docs/examples rather than confirmed against a live public server response.
