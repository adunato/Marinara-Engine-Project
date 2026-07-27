# CR015 Implementation Plan

Status: Draft — to be refined after detailed requirements and HLD approval

## Prerequisites

- Base application work on nested `Marinara-Engine/main` using `change/CR015-daily-conversation-memories`.
- Incorporate the forthcoming product requirements into the HLD and obtain approval before implementation.
- Read `packages/client/.instructions.md` before editing client code.
- Identify the existing summarisation, memory recall, built-in agent, Conversation settings, persistence, and prompt-assembly paths affected by the final design.

## Atomic Tasks

1. Finalize the daily-memory lifecycle, logical-day semantics, storage model, context format, defaults, limits, and interaction with existing memory features.
2. Add the built-in daily-memory agent and its server-side execution path.
3. Add persistence and lifecycle operations for daily memories, including the user-control behaviors required by the approved HLD.
4. Integrate enabled daily memories into Conversation generation context independently of summaries and current memory recall.
5. Add the approved Conversation UI and configuration controls.
6. Add focused automated coverage for agent execution, persistence, context composition, and feature combinations.
7. Run proportionate validation, including `pnpm check`, and document the result.
8. Decide with the user whether to add focused Playwright E2E validation for CR015.
9. Commit the completed application change, merge it into the requested local branch, update the tracker, and clean up the temporary worktree.

## Files Affected

To be finalized after repository analysis and requirements approval. Expected areas include:

- Built-in agent definitions and execution services.
- Conversation memory/context assembly on the server.
- Daily-memory persistence types and services.
- Conversation settings and daily-memory UI in the client.
- Shared schemas, API contracts, and defaults where required.
- Focused unit, integration, regression, and optionally E2E tests.
- `change_requests/CR015_daily_conversation_memories/HLD.md`
- `change_requests/CR015_daily_conversation_memories/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Verification

- Confirm daily memories work when summarisation and current memory recall are each enabled or disabled.
- Confirm memories respect the agreed Conversation, day, timezone, and visibility boundaries.
- Confirm users can inspect and control stored memories according to the approved requirements.
- Confirm failures do not block ordinary Conversation generation or corrupt existing memory data.
- Run focused automated coverage and `pnpm check` from the temporary application worktree.
- Verify clean Git status before worktree removal.

## Rollback

Revert the CR015 application commit(s). Any persisted-data rollback or cleanup procedure will be specified once the storage design is approved.

