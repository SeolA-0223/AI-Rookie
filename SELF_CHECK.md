# SELF_CHECK

- [x] `SPEC.md` requirements are implemented
- [x] Shared rubric was read before implementation
- [x] Korea-law MCP contract fallback is implemented
- [x] Commands run are listed below
- [x] Open risks are listed below

## Commands Run

- `npm run harness:check`
- `npm run test`
- `npm run eval`
- `npm run check`

## Open Risks

- The public README now anchors the default tool order, but a live deployed `mcp-kr-legislation` server is still needed to confirm runtime behavior end-to-end.
- The adapter still assumes the ordinance detail tool takes `ID`; that remains an inferred part of the ordinance contract until a live server or source code confirms it directly.
