# CR009 Implementation Plan

Status: Draft
Date: 2026-05-08

## Prerequisites

- Read `change_requests/CR009_custom_agent_data_tools/FEATURE_REQUEST.md`.
- Read `change_requests/CR008_data_storage_harmonization/ASSESSMENT.md`.
- Read `AGENTS.md`.
- If implementation touches client code, read `Marinara-Engine/packages/client/.instructions.md` first.
- Make application changes from a dedicated temporary app worktree if/when implementation begins.

## Atomic Tasks

1. Define shared tool contracts
   - Add tool definitions for `save_custom_data`, `search_custom_data`, `list_custom_data`, and `delete_custom_data`.
   - Add argument schemas/descriptions that steer models away from raw internal IDs.
   - Add built-in tool availability mapping for custom agents where appropriate.

2. Add storage schema/table support
   - Add a Drizzle-shaped `custom_agent_data` table definition.
   - Ensure the file-native table store persists `storage/tables/custom_agent_data.json`.
   - Include default/empty table behavior for fresh installs and existing file stores.
   - Preserve compatibility with any legacy SQLite opt-in path if required by existing storage conventions.

3. Add server storage facade
   - Create custom agent data storage methods:
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

5. Implement built-in tools
   - `save_custom_data`
   - `search_custom_data`
   - `list_custom_data`
   - `delete_custom_data`
   - Ensure unknown/missing context produces clear tool results.
   - Never expose raw embeddings in tool responses.

6. Implement search modes
   - Literal search: deterministic substring matching.
   - Fuzzy search: bounded lightweight non-vector matching.
   - Semantic search: optional embedding-backed scoring.
   - Reuse existing local embedding/cosine approach where practical, but keep semantic search optional.

7. Add tests
   - Storage facade tests.
   - Tool executor tests.
   - Scope resolution tests.
   - Search mode tests.
   - Semantic unavailable behavior tests.

8. Update documentation as needed
   - Update relevant docs if custom data tools are user-facing.
   - Document storage behavior if a new table is added to file storage docs.

## Likely Files Affected

- `Marinara-Engine/packages/shared/src/types/agent.ts`
- `Marinara-Engine/packages/shared/src/schemas/agent.schema.ts` if tool schema updates require it
- `Marinara-Engine/packages/server/src/services/tools/tool-executor.ts`
- `Marinara-Engine/packages/server/src/routes/generate.routes.ts`
- `Marinara-Engine/packages/server/src/db/schema/*`
- `Marinara-Engine/packages/server/src/db/schema/index.ts`
- `Marinara-Engine/packages/server/src/db/file-backed-store.ts`
- `Marinara-Engine/packages/server/src/services/storage/*`
- `Marinara-Engine/packages/server/test/*`
- `Marinara-Engine/docs/FILE_STORAGE_MIGRATION.md` if the file table map is updated

## Verification

- Run focused server tests for storage and tools.
- Run `cd Marinara-Engine && pnpm check`.
- If server/storage schema behavior changes trigger the existing workflow requirement, run `cd Marinara-Engine && pnpm db:push`.
- After implementation is complete, agree with the user whether focused Playwright E2E validation is useful for this CR.

## Rollback

- Remove tool definitions and executor cases.
- Remove custom agent data storage facade and tests.
- Remove or ignore the new table from file-native store initialization.
- If records were created in local test data, delete `storage/tables/custom_agent_data.json` only in test fixtures or with explicit user approval for real data.

