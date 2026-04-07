# SPEC

## Request Summary

Validate the public `korea-law-mcp` / `mcp-kr-legislation` contract, align the AI-Rookie source adapter with the currently documented ordinance-detail tools, and keep the harness/task files updated for this new iteration.

## CPS

- Context:
  AI-Rookie already has a Streamable HTTP MCP adapter and source-driven dashboard flow, but the adapter defaults were based on an inferred single tool name.
- Problem:
  The public `mcp-kr-legislation` documentation shows both `get_local_ordinance_detail` and `get_ordinance_detail`, so a single hardcoded default is brittle.
- Solution:
  Align the adapter with the public contract by preferring the documented local-ordinance tool, falling back to the generic ordinance tool, and updating tests/docs/handover to match.

## Target Users

- Primary:
  Maintainers iterating on AI-Rookie with Codex
- Secondary:
  Demo users validating regulation-change analysis with sample or MCP-backed inputs

## Goals

- Confirm the currently documented ordinance-detail tools exposed by `mcp-kr-legislation`
- Make the adapter robust to either documented tool name without manual env edits
- Keep existing dashboard and source-provider flows intact
- Update task docs and handover for the new iteration

## Non-Goals

- Connect to a real municipality DB in this task
- Redesign the dashboard UI again
- Prove the live MCP deployment contract beyond what the public repository documents

## Workstreams

1. Verify the public `mcp-kr-legislation` README contract for HTTP transport and ordinance-detail tools.
2. Update the Korea-law MCP adapter to prefer `get_local_ordinance_detail` and fall back to `get_ordinance_detail`.
3. Preserve env overrides for custom servers.
4. Add tests for both the preferred tool and the fallback tool path.
5. Update docs, spec, self-check, QA report, and handover to reflect the new contract understanding.

## File Touch Plan

- Adapter:
  `backend/src/sources/providers/koreaLawMcpSource.js`
- Tests:
  `tests/law-source.test.js`
- Docs and task state:
  `.env.example`, `README.md`, `docs/07_local_run.md`, `docs/13_vercel_deploy.md`, `docs/14_source_adapter_plan.md`, `SPEC.md`, `SELF_CHECK.md`, `QA_REPORT.md`, `docs/09_handover_status.txt`

## Technical Requirements

- Preserve existing Node/Vercel runtime setup
- Do not break current provider adapters or the dashboard source flow
- If `KOREA_LAW_MCP_DETAIL_TOOL_NAME` is explicitly set, honor it as a single override
- If no tool override is set, try the public README order automatically

## Validation Plan

- `npm run harness:check`
- `npm run test`
- `npm run eval`
- `npm run check`

## Acceptance Criteria

- The adapter no longer assumes only `get_ordinance_detail`
- The default runtime prefers `get_local_ordinance_detail` and falls back to `get_ordinance_detail`
- An explicit env override still wins over automatic tool selection
- Tests cover both tool-name paths
- Docs and handover reflect the updated public contract understanding
