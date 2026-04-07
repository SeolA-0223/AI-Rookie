# SELF_CHECK

- [x] `SPEC.md` requirements are implemented
- [x] Shared rubric was read before implementation
- [x] `npm run eval` now evaluates the default sample plus every municipality case pack
- [x] Top-level sample metrics stayed intact while `caseSuite` was added
- [x] Evaluation helper tests were added
- [x] Commands run are listed below
- [x] Open risks are listed below

## Commands Run

- `npm run test`
- `npm run eval`
- `npm run check`

## Open Risks

- A public live `korea-law-mcp` deployment endpoint is still not verified; public README evidence exists, but no reachable HTTP deployment was found and this workspace does not currently have a usable Python/uv runtime to launch the upstream server locally.
- The recommendation heuristic is still based on title/jurisdiction/date metadata rather than real observed production responses from a live MCP server.
- `npm run eval` now covers all current case packs, but the suite still assumes every case should produce the same perfect synthetic checks; once live ordinance inputs arrive, the thresholds and assertions will need recalibration.
