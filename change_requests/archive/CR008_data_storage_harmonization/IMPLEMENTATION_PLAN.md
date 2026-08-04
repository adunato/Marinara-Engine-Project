# CR008 Implementation Plan

Status: Draft discovery plan
Date: 2026-05-06

## Prerequisites

- Keep application code read-only for this CR unless the user approves a follow-up implementation.
- Treat CR007's `DESIGN_ASSESSMENT.md` as historical context only because the app has moved to file-native durable storage.
- Use `Marinara-Engine/docs/FILE_STORAGE_MIGRATION.md` and current server storage code as the source of truth for storage behavior.

## Discovery Tasks

1. Confirm durable storage backend
   - Read `docs/FILE_STORAGE_MIGRATION.md`.
   - Verify `packages/server/src/db/connection.ts` creates the file-native runtime store by default.
   - Record where SQLite remains relevant: one-time legacy import or explicit `STORAGE_BACKEND=sqlite`.

2. Map semantic lorebook storage
   - Inspect lorebook schema, storage facade, vectorization route, and scanner.
   - Record how embeddings are stored, invalidated, generated, and used.
   - Identify whether semantic lorebook search can share a future embedding/index service.

3. Map memory recall storage
   - Inspect `memory-recall.ts`, `local-embedder.ts`, chat schema, and generation injection points.
   - Record chunking, embedding, query, threshold, top-K, and scoping behavior.
   - Identify risks from local-only embedding and brute-force JSON-vector scanning.

4. Map built-in and custom tracker storage
   - Inspect `game-state.storage.ts`, `generate.routes.ts`, shared game-state types, prompt marker expansion, and agent tool execution.
   - Separate current-turn snapshot state from reusable long-term library facts.
   - Record how built-in and custom trackers share `game_state_snapshots`.

5. Map character memory command storage
   - Inspect character command parsing and generation command handling.
   - Inspect scene conclusion memory writes and conversation awareness reads.
   - Record retention behavior, target/source metadata, and lack of vectorization.

6. Map adjacent persisted narrative data
   - Inspect agent memory/runs, chat metadata, conversation notes, OOC influences, generated lorebook entries, and storage table map.
   - Classify each as authored library content, generated memory, runtime state, operational state, or media/settings.

7. Produce harmonization options
   - Define candidate record model and service boundaries.
   - Identify migration and compatibility constraints.
   - Split follow-up work into implementation CR candidates.

## Files Expected To Be Affected In This CR

- `change_requests/CR008_data_storage_harmonization/ASSESSMENT.md`
- `change_requests/CR008_data_storage_harmonization/HLD.md`
- `change_requests/CR008_data_storage_harmonization/IMPLEMENTATION_PLAN.md`
- `change_requests/tracker.md`

## Files Likely To Be Affected In A Future Implementation CR

- `Marinara-Engine/packages/server/src/db/schema/*`
- `Marinara-Engine/packages/server/src/db/file-backed-store.ts`
- `Marinara-Engine/packages/server/src/services/storage/*`
- `Marinara-Engine/packages/server/src/services/memory-recall.ts`
- `Marinara-Engine/packages/server/src/services/lorebook/*`
- `Marinara-Engine/packages/server/src/routes/generate.routes.ts`
- `Marinara-Engine/packages/server/src/routes/scene.routes.ts`
- `Marinara-Engine/packages/server/src/routes/conversation.routes.ts`
- `Marinara-Engine/packages/shared/src/types/*`
- `Marinara-Engine/docs/FILE_STORAGE_MIGRATION.md`
- User-facing import/export and backup docs if layout changes.

## Verification For This CR

- Check parent repo status before and after documentation edits.
- Verify CR008 tracker entry exists with the correct state.
- Commit the documentation-only CR opening changes in the parent repo.
- Do not run `pnpm check`; no application code is changed.

## Rollback

- Revert the CR008 docs folder and tracker row from the parent repo if the discovery CR is superseded before implementation.
- If a future implementation CR changes storage behavior, require explicit migration rollback notes in that CR.
