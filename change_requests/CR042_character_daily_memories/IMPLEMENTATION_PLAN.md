# CR042 Implementation Plan

Status: Approved for implementation

## Prerequisites

- Treat CR042 as a clean implementation against current Pasta-Devs `main` (`1a299369ac7025028c3ce1b80cc59f47b7b0691b`), not as continuation work on archived CR015 commits.
- Before creating the application worktree, run the repository branch-maintenance workflow and reconcile the clean mirror so `upstream/main`, `origin/upstream-main`, and local `upstream-main` represent the intended upstream base. Updating the Adunato remote mirror remains a separate remote-write action and must follow repository authorization rules.
- Create application branch `change/CR042-character-daily-memories` from the aligned clean upstream base and use a dedicated temporary application worktree.
- Read `packages/client/.instructions.md` before client edits.
- Keep Roleplay/Game support and automatic migration of archived CR015 records out of scope.

## Resolved Implementation Decisions

- Daily Memories are persisted in dedicated character-owned tables rather than inside `CharacterData` or Conversation metadata. This avoids card-version churn and gives scheduler state an explicit persistence boundary.
- The persistence model uses settings, day, run, run-source, and memory records. A day points to its active run. Initial formation may expose successful source results while the day is partial; regeneration is staged in a separate run and becomes active only after the complete replacement succeeds.
- Automatic scheduling starts from an enablement anchor. Enabling or re-enabling a character makes the most recently completed handover window eligible, then future catch-up covers later missed handovers. It does not automatically backfill the character's entire historical corpus; older completed windows remain manually generatable from the UI.
- A deleted day leaves a scheduler tombstone rather than becoming silently eligible for automatic re-creation. Manual Generate/Regenerate can explicitly replace that tombstone.
- The effective timezone is read server-side from synced app setting `ui.conversationTimeZone`, validated with the existing Conversation timezone helpers. Historical day rows persist the timezone, handover, window start, and window end actually used.
- Source windows are `[windowStart, windowEnd)`. Source discovery uses Conversation-mode chats whose parsed `characterIds` contains the character and which contain eligible messages in the window.
- Source processing is strictly Conversation-by-Conversation. If a single source transcript must be chunked for provider context limits, all chunks for that source remain contiguous and sequential; chunks from another Conversation are never interleaved.
- Formation connection resolution is character-scoped: explicit configured connection first, then the default agent connection/fallback infrastructure. It does not fall back to an arbitrary source Conversation's chat connection.
- Daily Memory embeddings reuse `resolveMemoryRecallEmbeddingSource()` and `embedMemoryRecallTexts()`. The character's resolved formation connection supplies the embedding configuration; local embedding remains the fallback. Embedding is best-effort: valid formed/manual/edited memories persist with null `embedding` and `embeddingSpaceId` when vectorization fails and remain excluded from retrieval. Stored `embeddingSpaceId` values prevent cross-space comparison; an embedding failure does not fail or retry source formation.
- Changing the formation connection triggers character-memory re-vectorization. Retrieval only considers memories in the currently resolved embedding space; ordinary generation continues if vectorization is temporarily unavailable.
- Scheduler integration belongs in `buildApp()` beside the existing server autonomous scheduler. It uses one global worker by default, persisted idempotency, deferred startup reconciliation, and an `onClose` stop hook.
- Character Daily Memories APIs are registered as a second `/api/characters` plugin with routes beneath `/:characterId/daily-memories/...`.
- Conversation generation integration belongs in `packages/server/src/routes/generate/conversation-history-runtime.ts`, preserving existing summary and current memory-recall paths.
- The Character Editor receives a dedicated `Memories` tab implemented primarily in a focused component rather than expanding `CharacterEditor.tsx` with all memory-management logic.

## Atomic Tasks

1. Add shared `character-daily-memory` types, constants, defaults, and Zod schemas for settings, day/run/source status, memory records, formation output, CRUD requests, preview, and ranking configuration.
2. Add `packages/server/src/db/schema/character-daily-memories.ts` with dedicated settings/day/run/run-source/memory tables; export it from the schema barrel and register the tables with file-backed storage, sharding/protection lists, and character cascades.
3. Add `createCharacterDailyMemoriesStorage()` for settings persistence, day/run creation, active-run swaps, source state, memory CRUD, tombstones, idempotent lookup, and character-scoped listing.
4. Extend Conversation timezone helpers with a public zoned wall-clock-to-instant helper and implement CR042 window enumeration: most recent completed handover, next local-calendar handover, exact preceding 24-hour source window, and stable internal day key.
5. Add server-side resolution of the synced Conversation timezone from app setting `ui`, with safe fallback to current server-local Conversation semantics when the setting is absent/invalid.
6. Implement source discovery: filter current `chats` to Conversation mode and target `characterIds`, query `[start,end)` messages, reject empty sources, and snapshot source Conversation name/ID for provenance without a destructive FK to the chat.
7. Implement speaker-attributed transcript construction using current persona/character names and transcript sanitization. Include user, assistant, and narrator content; exclude system/internal prompt messages.
8. Add character Daily Memory formation connection resolution using explicit character configuration, default agent connection, Local Model/random handling as supported by existing connection infrastructure, and normal agent fallback wrapping.
9. Implement structured extraction for one source Conversation at a time, including bounded per-source transcript chunking when required, `{ memories: [{ text, importance }] }` validation, zero-memory success, connection/model snapshotting, and no cross-Conversation consolidation pass.
10. Implement best-effort embedding with the existing memory-recall embedding stack, persisting `embeddingSpaceId` only when vectorization succeeds. Persist valid formed/manual/edited memory rows with null embedding/space on failure, exclude those rows from retrieval, and do not fail or repeat source formation solely because embedding failed. Add re-vectorization for formation-connection changes and safe retrieval degradation while embeddings are unavailable/stale.
11. Implement initial day orchestration: freeze source list in a run, create run-source rows, process pending sources sequentially, retain successful source results across retries, and mark the active day `partial`, `complete`, `empty`, or `failed` deterministically.
12. Implement regeneration as a separate staging run. Do not mutate the active run while replacement work is incomplete; atomically switch `activeRunId` only after every source succeeds/empty-succeeds, then retire the replaced run's memories.
13. Implement automatic enablement anchors and day tombstones so startup catch-up does not backfill all history and user-deleted days are not silently regenerated.
14. Implement a single-worker `character-daily-memory-scheduler.service.ts`: next-handover timer, priority queue ordered by window end, duplicate-job suppression, retry/backoff, late-timer reconciliation, startup catch-up, refresh after settings/timezone changes, and clean stop semantics.
15. Start the scheduler from `packages/server/src/app.ts` after route/runtime setup without blocking startup. Trigger scheduler refresh from Daily Memory settings changes and synced `ui` timezone updates.
16. Add character-scoped HTTP routes for settings, day listing/status, manual generation, regeneration, day deletion, manual memory CRUD, qualifying Conversation listing, and retrieval preview.
17. Implement deterministic retrieval using the configured last `N` current-Conversation messages, the character's active memory sets in the current embedding space, cosine semantic score, normalized importance, approximately 30-day exponential recency decay, normalized user weights, and minimum-rank filtering with no final result-count cap.
18. Integrate retrieval into Conversation history assembly. For each enabled character in the current Conversation, retrieve independently and inject an explicitly delimited character/date-grouped Daily Memories block. Failure must not block ordinary generation.
19. Add `packages/client/src/hooks/use-character-daily-memories.ts` for settings/day/memory/preview queries and serialized mutations.
20. Add a `Memories` tab to `CharacterEditor.tsx` and create `CharacterMemoriesTab.tsx` for enablement, handover, formation connection, prompt/reset, recent-message count, ranking controls, preview source, day grouping, compact editable cards, source provenance, manual add/edit/delete, day deletion, missing-day generation, regeneration confirmation, and progress/partial/error states.
21. Add focused regressions covering window/DST rules, enablement anchor, tombstones, source discovery, per-source sequential execution, structured formation, idempotency, partial retry, regeneration swap, best-effort embedding persistence/retrieval exclusion without duplicate source formation, embedding-space changes, ranking, scheduler startup catch-up, and context formatting. Add a focused package script such as `regression:character-daily-memories`.
22. Run the focused regressions, schema/file-storage verification as applicable, `git diff --check`, and one repository baseline `pnpm check` after the complete cross-cutting implementation.
23. Commit the completed application branch. Do not merge it into the clean upstream mirror. Integrate/ship it only after validation, then update the tracker and remove the temporary worktree.

## Expected Files and Areas

### Shared

- `packages/shared/src/types/character-daily-memory.ts` — new public contracts/defaults.
- `packages/shared/src/schemas/character-daily-memory.schema.ts` — new API/formation validation.
- shared barrel exports as required.

### Server persistence and services

- `packages/server/src/db/schema/character-daily-memories.ts` — new file-backed tables.
- `packages/server/src/db/schema/index.ts` — export new schema.
- `packages/server/src/db/file-backed-store.ts` — table catalog, sharding/cascade registration where required.
- `scripts/protect-launcher-data.mjs` — keep protected file-backed table inventory aligned when required by the storage format.
- `packages/server/src/services/storage/character-daily-memories.storage.ts` — persistence boundary.
- `packages/server/src/services/character-daily-memories/window.ts` — handover/window helpers.
- `packages/server/src/services/character-daily-memories/connection-resolution.ts` — formation connection resolution.
- `packages/server/src/services/character-daily-memories/formation.service.ts` — source discovery/transcript/extraction/orchestration.
- `packages/server/src/services/character-daily-memories/embedding.service.ts` — embedding and re-vectorization boundary.
- `packages/server/src/services/character-daily-memories/retrieval.service.ts` — ranking and formatting input.
- `packages/server/src/services/character-daily-memories/scheduler.service.ts` — timer/queue/reconciliation.
- `packages/server/src/services/conversation/timezone.ts` — export/reuse zoned wall-clock instant conversion.
- `packages/server/src/services/memory-recall.ts` and `memory-recall-embedding.ts` — reuse existing exported embedding contracts/helpers; modify only if a small shared export is required.

### Server routes/runtime

- `packages/server/src/routes/character-daily-memories.routes.ts` — new character-scoped API.
- `packages/server/src/routes/index.ts` — register the new routes under `/api/characters`.
- `packages/server/src/routes/app-settings.routes.ts` — request scheduler refresh when synced Conversation timezone changes.
- `packages/server/src/routes/generate/conversation-history-runtime.ts` — Daily Memories retrieval/context injection.
- `packages/server/src/app.ts` — scheduler lifecycle start/stop integration.

### Client

- `packages/client/src/hooks/use-character-daily-memories.ts` — React Query API boundary.
- `packages/client/src/components/characters/CharacterEditor.tsx` — add `Memories` tab and lazy/focused composition.
- `packages/client/src/components/characters/CharacterMemoriesTab.tsx` — primary CR042 UI.
- `packages/client/src/components/chat/SummariesEditorModal.tsx` — reference only unless a small reusable presentation primitive is clearly justified.

### Validation

- `scripts/regressions/character-daily-memories.regression.ts` and/or a focused scheduler companion if separation materially improves clarity.
- `package.json` — focused regression script.
- Optional later Playwright specs under parent `tests/e2e/specs/change-requests/CR042/` only after agreement.

## Verification

- Confirm branch ancestry is the intended aligned current upstream base with no unrelated fork-local CR commits.
- Confirm enable/re-enable anchors begin automatic processing at the most recently completed handover rather than backfilling all historical days.
- Confirm exact scheduled handover instants and exact preceding 24-hour `[start,end)` windows across normal days and DST transitions.
- Confirm persisted day identity does not change when handover/timezone settings change later.
- Confirm source discovery includes every qualifying Conversation for the character and excludes unrelated, Roleplay, Game, empty, and system-only sources.
- Prove source Conversations execute serially; any transcript chunks for one source finish before the next source begins.
- Confirm structured output accepts zero or more memories and rejects invalid text/importance values.
- Confirm an embedding failure still persists each valid memory once with null embedding/space, leaves the source success/empty, excludes that memory from retrieval, and does not repeat source extraction during retry/reconciliation.
- Confirm successful source results survive another source's failure and retries do not rerun/duplicate terminal source states.
- Confirm duplicate timers, manual trigger overlap, restart, and startup reconciliation are idempotent at day/run/source level.
- Confirm regeneration preserves the old active set until the full staging run succeeds, then swaps exactly once.
- Confirm day deletion leaves a tombstone that prevents automatic re-creation but can be explicitly generated later.
- Confirm startup after one or several missed handovers queues eligible missing windows oldest-first and requires no user message.
- Confirm changing handover/timezone refreshes future scheduling without rewriting historical windows.
- Confirm changing formation connection re-vectorizes existing active memories into the new embedding space and retrieval never compares mismatched vector spaces.
- Confirm manual add/edit/delete refreshes/removes embeddings consistently.
- Confirm ranking uses CR015 defaults (50/35/15, ~30-day half-life, 30% threshold), normalizes arbitrary relative weights, applies no final result-count cap, and makes no memory-selection LLM call.
- Confirm multi-character Conversation generation retrieves each character independently and clearly labels character/date blocks.
- Confirm Daily Memories failure does not block normal Conversation generation and existing summaries/current memory recall remain independent.
- Confirm Character Memories UI settings persistence, prompt reset, preview, provenance, CRUD, generation/regeneration progress, tombstone/missing-day behavior, partial/error/empty states, scrolling, and narrow layout.
- Run `pnpm db:push` only if the current checkout defines/requires it for file-backed schema verification.
- Run focused CR042 regressions and one `pnpm check` after the complete change.
- After behavior-bearing implementation is complete, agree whether to add focused Playwright API/UI coverage.

## Rollback

- Stop/remove the Character Daily Memories scheduler lifecycle registration.
- Remove character Daily Memories context injection and route/UI registration.
- Revert CR042 application commits from the change branch; never modify the clean `upstream-main` mirror to roll back the feature.
- Preserve persisted CR042 tables during a code rollback unless a separately validated data-removal migration is explicitly requested. Do not leave orphaned vector records or partially removed character cascades.
