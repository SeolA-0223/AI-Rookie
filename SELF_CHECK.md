# SELF_CHECK

- [x] `SPEC.md` requirements are implemented
- [x] Shared rubric was read before implementation
- [x] Harness files and automation are aligned
- [x] Source-driven dashboard flow was checked
- [x] Commands run are listed below
- [x] Open risks are listed below

## Commands Run

- `npm run harness:check`
- `npm run test`
- `npm run eval`
- `npm run check`
- `npm run smoke` with local server

## Open Risks

- The live `korea-law-mcp` tool contract is still inferred from public examples. A real server should confirm tool name, argument name, and response shape.
- The dashboard source-status panel is advisory for request-selected MCP flows; it does not yet expose per-provider runtime capabilities from the backend.
