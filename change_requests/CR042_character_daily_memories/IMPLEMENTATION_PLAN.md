# CR042 Implementation Plan

Status: Approved for implementation

## Prerequisites

- Treat CR042 as a clean implementation against current Pasta-Devs `main` (`1a299369ac7025028c3ce1b80cc59f47b7b0691b`), not as continuation work on archived CR015 commits.
- Before creating the application worktree, run the repository branch-maintenance workflow and reconcile the clean mirror so `upstream/main`, `origin/upstream-main`, and local `upstream-main` represent the intended upstream base. Updating the Adunato remote mirror remains a separate remote-write action and must follow repository authorization rules.
- Create application branch `change/CR042-character-daily-memories` from the aligned clean upstream base and use a dedicated temporary application worktree.
- Read `packages/client/.instructions.md` before client edits.
- Trace current upstream implementations before selecting exact reuse points: Conversation auto-summary logical-day/timezone helpers, chat/message storage and `Chat.characterIds`, character persistence/cascade behavior, connection resolution, embedding/vector memory infrastructure, Conversation generation context assembly, `SummariesEditorModal`, `CharacterEditor`, server startup/shutdown, and settings synchronization.
- Keep Roleplay/Game support and automatic migration of archived CR015 records out of scope unless a concrete integration target makes either necessary.

## Atomic Tasks

1. Define shared character Daily Memories types and schemas: character settings, memory records, formation-run/source state, structured formation output, ranking configuration, and API request/response contracts.
2. Add character-owned persistence for Daily Memories settings, stable memory records, source Conversation provenance, importance, window/date identity, formation status, retry metadata, and embedding/vector linkage. Register cascade cleanup for character deletion.
3. Implement character memory-day helpers that resolve a configured `HH:mm` handover in the effective Conversation timezone and calculate the exact preceding 24-hour completed window, including deterministic DST behavior.
4. Implement source discovery for one character/day using Conversation-mode chats whose `characterIds` contains the target character and which have eligible messages in the completed window.
5. Implement speaker-attributed per-source transcript construction and target-character-aware prompt construction without mixing messages from different source Conversations.
6. Implement sequential per-Conversation formation using the selected connection/model, structured JSON validation, 1–5 importance validation, zero-memory success, source-level failure recording, and embedding-on-write.
7. Implement idempotent character/day/source execution so duplicate timers, retry, restart, and reconciliation cannot duplicate successful source results.
8. Implement a character/day orchestration service that freezes the source list, processes pending sources sequentially, marks complete/partial/failed state, and supports bounded retries.
9. Add a server-owned scheduler service that calculates next due handovers, enqueues due character/day jobs, recalculates after configuration changes, and exposes clean start/stop lifecycle methods.
10. Integrate scheduler startup reconciliation into the server lifecycle after storage/server readiness: discover all completed missing/retryable windows, enqueue them oldest-first, and ensure a server started after the handover automatically catches up without user activity.
11. Add character-scoped APIs for reading/updating Daily Memories configuration, listing day-grouped memories and formation status, and obtaining missing completed days.
12. Add lifecycle APIs for manual memory add/edit/delete, whole-day delete, specific missing-day generation, and destructive day regeneration. Regeneration must build a complete replacement set before swapping the existing day and must reject the current incomplete window.
13. Implement character-scoped retrieval: embed the configured recent messages from the current Conversation, vector-prefilter the target character's persisted memories, deterministically rerank semantic/importance/recency factors, apply the minimum-rank threshold, and make no memory-selection LLM call.
14. Integrate retrieved Daily Memories into Conversation generation context. For multi-character Conversations, retrieve independently per enabled character and emit explicitly labelled, date-grouped character blocks while preserving existing summary and memory-recall context paths.
15. Add a Character Editor `Memories` tab and character-level hooks/API state. Include enablement, handover, connection/model, prompt editing/reset, recent-message count, ranking weights, and minimum-rank controls.
16. Recreate CR015's day-oriented memory management experience inside the Character Memories tab: day grouping, compact editable cards, importance control, manual add/edit/delete, whole-day delete, missing-day generation, regeneration confirmation, source provenance, save/cancel, and loading/empty/partial/error states.
17. Add a character-scoped retrieval preview that uses a selected qualifying Conversation as the recent-message query source without modifying memories or exposing unrelated transcript text.
18. Add focused shared/server/client regression coverage for time windows, source discovery, sequential execution, scheduler catch-up, idempotency, partial failure/retry, CRUD/regeneration, ranking, context injection, and UI state.
19. Run schema verification as applicable and the repository baseline `pnpm check`; inspect `git diff --check` and ensure the application worktree is clean after the final commit.
20. Commit the completed application branch. Do not merge it into the clean upstream mirror. Integrate/ship it according to the requested branch strategy only after validation, then update the CR tracker and remove the temporary worktree.

## Expected Files and Areas

Exact paths should be finalized after implementation analysis. Expected areas include:

- `packages/shared/src/types/*` and `packages/shared/src/schemas/*` for character Daily Memories contracts.
- `packages/server/src/db/schema/*` and file-backed table/cascade registration for character settings, memories, and formation state.
- `packages/server/src/services/conversation/*` for reusable timezone/window logic where appropriate.
- New server Daily Memories formation, retrieval, and scheduler services under the existing service organization.
- `packages/server/src/services/storage/*` or equivalent current storage abstractions for source discovery and memory lifecycle operations.
- `packages/server/src/routes/*` for character-scoped Daily Memories APIs.
- `packages/server/src/routes/generate/*` for Conversation prompt-context integration.
- `packages/server/src/index.ts` or the established server lifecycle hook for scheduler start/stop and startup reconciliation.
- Existing embedding/vector infrastructure, reused without coupling Daily Memories to unrelated stored-memory ownership.
- `packages/client/src/hooks/*` for character Daily Memories queries/mutations.
- `packages/client/src/components/characters/CharacterEditor.tsx` plus focused character-memory UI components/modal(s) as needed.
- `packages/client/src/components/chat/SummariesEditorModal.tsx` only as a behavior/layout reference unless a reusable abstraction is clearly justified.
- Focused regression scripts/tests and, if later agreed, `tests/e2e/specs/change-requests/CR042/` in the parent validation harness.
- Parent documentation: `change_requests/CR042_character_daily_memories/HLD.md`, `IMPLEMENTATION_PLAN.md`, and `change_requests/tracker.md`.

## Verification

- Confirm implementation branch ancestry is the intended aligned current upstream base and contains no unrelated fork-local CR code.
- Confirm each due character/day uses the exact scheduled 24-hour window and persists stable historical window identity.
- Confirm qualifying Conversation discovery is character-scoped and mode-scoped, including multi-character Conversations and excluding unrelated/Roleplay/Game chats.
- Instrument/test formation to prove one provider request contains one source Conversation only and that source Conversations execute sequentially.
- Confirm structured output accepts zero or more memories, rejects invalid importance values, and writes embeddings before retrieval eligibility.
- Confirm duplicate job execution is idempotent and restart-safe at character/day/source level.
- Confirm a failed source can retry without rerunning or duplicating successful sources and that a day exposes partial state until all frozen sources complete.
- Confirm startup after a missed handover automatically queues the completed window and several missed days are caught up oldest-first.
- Confirm normal scheduled execution fires without requiring a user message and timer lateness/system sleep is reconciled safely.
- Confirm configuration changes update future schedule calculations without silently shifting or regenerating historical memory days.
- Confirm manual add/edit/delete/day-delete/generate/regenerate behavior and embedding maintenance, including atomic replacement semantics for regeneration.
- Confirm retrieval uses only the target character's pool, makes no selection LLM call, preserves CR015 ranking defaults/controls, and safely fails open when vector retrieval is unavailable.
- Confirm multi-character Conversation context keeps each character's Daily Memories clearly separated and existing summaries/memory recall remain independent.
- Confirm Character Memories UI persistence, prompt reset, source provenance, generation progress, partial/error/empty states, scrolling, and responsive layout.
- Run `pnpm db:push` when the final persistence change requires schema verification.
- Run `pnpm check` once for the substantive cross-cutting application change, plus focused regressions that cover scheduler and memory behavior without redundant broad validation.
- After behavior-bearing implementation is complete, agree with the user whether to add focused Playwright API/UI coverage for CR042.

## Rollback

- Disable/stop the Character Daily Memories scheduler and remove its server lifecycle registration.
- Remove character Daily Memories context injection so ordinary Conversation generation returns to upstream behavior.
- Revert character-memory UI and API registration.
- Preserve persisted Daily Memories records during a code rollback unless an explicit, separately validated migration/removal is required; do not leave orphaned vector entries or partially deleted character data.
- Revert the CR042 application commit(s) on the change branch rather than modifying the clean `upstream-main` mirror.