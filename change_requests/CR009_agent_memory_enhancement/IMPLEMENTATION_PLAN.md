# CR009 Agent Memory Enhancement Implementation Plan

Status: Draft
Date: 2026-05-08

## Prerequisites

- Read `change_requests/CR009_agent_memory_enhancement/FEATURE_REQUEST.md`.
- Read `change_requests/CR008_data_storage_harmonization/ASSESSMENT.md`.
- Read `AGENTS.md`.
- If implementation touches client code, read `Marinara-Engine/packages/client/.instructions.md` first.
- Make application changes from a dedicated temporary app worktree if/when implementation begins.

## Atomic Tasks

1. Define shared tool contracts
   - Add tool definitions for `save_agent_memory`, `search_agent_memory`, `list_agent_memory`, and `delete_agent_memory`.
   - Add argument schemas/descriptions that steer models away from raw internal IDs.
   - Add built-in tool availability mapping for custom agents where appropriate.

2. Decide the `agent_memory` evolution path
   - Evaluate whether to supersede, extend, or coexist with the existing `agent_memory` table.
   - Prefer an enhanced `agent_memory` path unless the table shape makes that too risky.
   - Define the target enhanced `agent_memory` row shape, including how current `key`/`value` rows are represented.
   - If adding a successor table, add a Drizzle-shaped table definition and compatibility reads from current `agent_memory`.
   - If extending/superseding `agent_memory`, document the compatibility strategy for `storage/tables/agent_memory.json`.
   - Ensure the file-native table store persists the chosen table snapshot.
   - Include default/empty table behavior for fresh installs and existing file stores.
   - Preserve compatibility with any legacy SQLite opt-in path if required by existing storage conventions.

3. Add server storage facade
   - Create enhanced agent memory storage methods:
     - create/update record
     - get by ID
     - list by namespace/scope/cursor
     - search candidate loading
     - soft/hard delete
   - Parse and serialize metadata/embedding JSON consistently with existing storage facades.

4. Extend tool execution context
   - Add `chatId`, active character identity, and `agentConfigId` to `ToolExecutionContext`.
   - Populate these fields from generation/agent execution paths.
   - Validate character selectors against active characters.

5. Account for existing `agent_memory`
   - Audit current `agent_memory` use sites, especially `secret-plot-driver`.
   - Preserve current keys and behavior: `overarchingArc`, `sceneDirections`, `recentlyFulfilled`, `pacing`, and `staleDetected`.
   - Preserve the current clear-runs behavior that restores `overarchingArc`.
   - If rerouting secret plot to the enhanced agent memory service, add compatibility reads for existing `agent_memory` rows or an explicit migration.
   - If leaving legacy-shaped `agent_memory` in place, document why two agent storage surfaces remain.

6. Implement built-in tools
   - `save_agent_memory`
   - `search_agent_memory`
   - `list_agent_memory`
   - `delete_agent_memory`
   - Ensure unknown/missing context produces clear tool results.
   - Never expose raw embeddings in tool responses.

7. Implement search modes
   - Literal search: deterministic substring matching.
   - Fuzzy search: bounded lightweight non-vector matching.
   - Semantic search: optional embedding-backed scoring.
   - Reuse existing local embedding/cosine approach where practical, but keep semantic search optional.

8. Add tests
   - Storage facade tests.
   - Tool executor tests.
   - Scope resolution tests.
   - Search mode tests.
   - Semantic unavailable behavior tests.
   - Secret plot agent memory regression tests if `agent_memory` is superseded or rerouted.

9. Update documentation as needed
   - Update relevant docs if agent memory tools are user-facing.
   - Document storage behavior if a new table is added or `agent_memory` changes role.

## Likely Files Affected

- `Marinara-Engine/packages/shared/src/types/agent.ts`
- `Marinara-Engine/packages/shared/src/schemas/agent.schema.ts` if tool schema updates require it
- `Marinara-Engine/packages/server/src/services/tools/tool-executor.ts`
- `Marinara-Engine/packages/server/src/routes/generate.routes.ts`
- `Marinara-Engine/packages/server/src/db/schema/*`
- `Marinara-Engine/packages/server/src/db/schema/index.ts`
- `Marinara-Engine/packages/server/src/db/file-backed-store.ts`
- `Marinara-Engine/packages/server/src/services/storage/*`
- `Marinara-Engine/packages/server/src/services/storage/agents.storage.ts` if `agent_memory` is extended or compatibility adapters are added
- `Marinara-Engine/packages/server/src/routes/agents.routes.ts` if clear-memory behavior changes
- `Marinara-Engine/packages/server/test/*`
- `Marinara-Engine/docs/FILE_STORAGE_MIGRATION.md` if the file table map is updated

## Verification

- Run focused server tests for storage and tools.
- Run `cd Marinara-Engine && pnpm check`.
- If server/storage schema behavior changes trigger the existing workflow requirement, run `cd Marinara-Engine && pnpm db:push`.
- After implementation is complete, agree with the user whether focused Playwright E2E validation is useful for this CR.

## Rollback

- Remove tool definitions and executor cases.
- Remove enhanced agent memory storage facade changes and tests.
- Remove or ignore the new table from file-native store initialization.
- If records were created in local test data, delete only test fixture data or explicitly approved local data. Do not delete real `storage/tables/agent_memory.json` data without user approval.
