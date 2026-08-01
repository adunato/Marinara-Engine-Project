# CR030 Implementation Plan — Staged Character Mind Editing

## Status

Implemented on `change/CR030-staged-character-mind-editing` in application commit `a4e67dd88`. The focused Character Mind regression and server TypeScript validation passed. The single broad `pnpm check` attempt reached its command limit during the client build and was not repeated.

## Prerequisites

- CR019 Character Mind storage, tools, service, and operation surface.
- CR021 runtime/tool failure reporting.
- CR022 corpus-wide Build mapping.
- CR024 shared LLM transport retries.
- CR025 isolated page sessions.
- CR026 streamed page requests.
- CR029 resumable Build maps and page checkpoints.

## Tasks

### 1. Separate content output modes

1. Keep current small JSON results for Build mapping, Ingest discovery/results, Query, and Lint discovery/results.
2. Add a runtime path that captures a successfully completed ordinary streamed response as raw Markdown for one bound page or index target.
3. Ensure partial, empty, fenced incorrectly, or oversized Markdown responses fail before file mutation.
4. Do not require provider-native structured output or fine-grained tool-input streaming.

### 2. Add temporary candidate handling

1. Create a short-lived per-operation temporary directory using existing safe path conventions.
2. Copy only affected existing pages and `index.md` into it as candidates are requested.
3. Record the live content hash or absent-path precondition for every affected path.
4. Make LLM edit tools resolve only against candidate files.
5. Remove the temporary directory after success, failure, conflict, or cancellation.

### 3. Replace complete-content write tools

1. Remove complete page/index content from `mind_write_wiki` and `mind_write_index` usage.
2. Add one bounded exact-replacement or patch-style candidate edit tool with unique-match validation.
3. Bind page creation and full replacement to a target selected by Marinara and accept their complete content only through the ordinary streamed Markdown runtime path.
4. Preserve existing list, search, read, path containment, raw integrity, trace, and size protections.

### 4. Migrate Build page materialization

1. Leave the CR022/CR029 corpus-map representation and validation unchanged.
2. Change each `build-page` session to return its target page as ordinary streamed Markdown.
3. Validate and atomically publish each successful page, then append the existing page-success checkpoint.
4. Preserve current sequential execution, retry limits, cancellation, and incomplete-Build resume behavior.

### 5. Add Ingest discovery and candidate execution

1. Add a read-only Ingest discovery result listing bounded create, edit, replace, rename, delete, and index actions.
2. Let the same session correct incomplete or invalid action lists before editing begins.
3. Execute each planned page action against temporary candidates, using targeted edits by default and explicit streamed replacement when necessary.
4. Compose merge, split, rename, and retirement from the basic action list rather than adding separate workflow engines.
5. Validate the complete affected overlay before publication.
6. Mark the raw revision successful only after publication and the success log entry.

### 6. Migrate index and Lint maintenance

1. Preserve the existing Build-derived index format.
2. Use bounded candidate edits for ordinary Ingest/Lint index maintenance.
3. Permit explicit complete-index streamed replacement only for substantial Lint reorganization.
4. Have Lint return a bounded repair action list and execute it through the same candidate primitives.
5. Preserve existing deterministic findings and automatic lint cadence.

### 7. Add conflict-safe publication

1. Validate candidate pages, index, links, citations, moves, and deletions as one proposed overlay.
2. Recheck affected live hashes and absent-path preconditions immediately before publication.
3. Fail without publication when an affected live file changed manually.
4. Publish with existing atomic per-file writes and safe move/delete operations.
5. Retain temporary originals during publication and attempt immediate restoration if a later filesystem action fails.
6. Keep the existing documented residual crash window; do not add a durable commit journal or startup recovery.

### 8. Extend focused regression coverage

1. Assert that complete page/index content no longer appears in tool arguments.
2. Cover streamed creation and replacement, targeted edit success, missing/ambiguous edit matches, and oversize rejection.
3. Cover unchanged Build maps, sequential page publication, failure, retry, cancellation, and CR029 resume.
4. Cover Ingest discovery correction and an initially unknown multi-page affected set.
5. Cover merge, split, rename, retirement, inbound-link validation, and index updates through composed actions.
6. Cover provider failure before completion, candidate validation failure, and unchanged live synthesis.
7. Cover manual edits between candidate generation and publication producing a conflict.
8. Preserve current Query grounding and raw-integrity regressions without changing Query behavior.

## Expected files

- `packages/server/src/services/character-mind/character-mind.constants.ts`
- `packages/server/src/services/character-mind/character-mind.files.ts`
- `packages/server/src/services/character-mind/character-mind.plan.ts`
- `packages/server/src/services/character-mind/character-mind.runtime.ts`
- `packages/server/src/services/character-mind/character-mind.service.ts`
- `packages/server/src/services/character-mind/character-mind.tools.ts`
- `scripts/regressions/character-mind.regression.ts`
- a small focused candidate helper below `packages/server/src/services/character-mind/` only if it keeps temporary-file and overlay validation logic clearer

No client, route, database, dependency, backup-format, release, or version changes are expected.

## Verification

1. Run the focused Character Mind regression once.
2. Run server TypeScript validation.
3. Run `pnpm check` once because the runtime/tool/service change is substantive and cross-cutting within Character Mind.
4. After approved implementation is merged into the primary application checkout, run the production build there before manual validation.
5. Agree with the user whether focused Playwright E2E adds useful evidence after implementation is complete.

## Rollback

Revert the CR030 application commit(s) to restore CR029's complete-content write tools and existing operation behavior. Temporary candidate directories are non-durable and contain no authoritative data. Raw sources, completed wiki pages, `SCHEMA.md`, `index.md`, and `log.md` remain in their existing locations and formats.

## Approval gate

Implementation begins only after the user approves the revised `HLD.md` or gives a direct instruction to implement it. Material expansion into durable workflow recovery, new index ownership, Query contract changes, or new UI/API state requires separate design approval.
