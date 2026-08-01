# CR030 Implementation Plan — Staged Character Mind Editing

## Status

Proposed. Do not begin application implementation until the HLD is approved.

## Prerequisites

- CR019 Character Mind storage, tools, service, and operation surface.
- CR021 explicit runtime/tool failure reporting.
- CR022 corpus-wide Build mapping.
- CR024 shared LLM transport retries.
- CR025 isolated page sessions.
- CR026 streamed page materialization.
- CR029 resumable Build maps, page checkpoints, and per-request timeouts.

## Implementation sequence

### 1. Define operation state and output contracts

1. Add internal types for snapshot hashes, frozen change plans, candidate status, topology operations, commit journals, conflicts, and resumable operation state.
2. Separate small JSON final results from ordinary streamed Markdown/briefing results in the Character Mind runtime.
3. Preserve provider neutrality: do not require a provider-native structured-output mode or fine-grained tool-input streaming.
4. Update shared API types only where status, conflict, resume, or result representation must be exposed to the existing controls.

### 2. Add private staging and snapshot support

1. Reserve and contain a non-wiki `.marinara/` operation directory within each mind.
2. Snapshot `SCHEMA.md`, `index.md`, the complete wiki, and relevant raw revisions with content hashes.
3. Copy or materialize the candidate synthesis into per-operation staging without exposing it through wiki tools or Obsidian navigation.
4. Persist the frozen plan and candidate completion hashes after every successful planning/page step.
5. Ensure list/search/read tools cannot escape into private operation metadata unless Marinara explicitly reads it for recovery.

### 3. Replace live write tools with candidate executors

1. Remove complete-content `mind_write_wiki` and `mind_write_index` from Character Mind agent sessions.
2. Bind creation and replacement sessions to one target and capture their complete ordinary streamed response as candidate Markdown.
3. Add one bounded, exact, unique-match edit tool that operates only on the current staged target.
4. Retain existing read, list, search, raw-integrity, path-containment, and trace behavior.
5. Record candidate diffs and hashes from actual staged changes rather than trusting model-reported paths.

### 4. Migrate initial Build

1. Persist the complete corpus map in the private operation journal.
2. Materialize each mapped page sequentially into staging using ordinary streamed Markdown.
3. Resume completed candidates only when source revisions, plan, and base hashes match.
4. Render the final generated index catalog from the validated map.
5. Validate and commit the complete initial wiki as one operation.
6. Support safe import of a valid legacy CR029 incomplete Build checkpoint without deleting visible synthesis before commit.

### 5. Add incremental Ingest planning

1. Replace dynamic live maintenance with a read-only impact-planning session for each pending raw revision.
2. Validate no-change, edit, create, replace, rename, merge, split, and retirement decisions.
3. Expand inbound-link and index dependencies deterministically before freezing the change set.
4. Execute each planned page candidate sequentially against the shared staged end state.
5. Mark the raw revision successfully ingested only after the full operation commits and logs successfully.

### 6. Implement topology execution

1. Stage creates, replacements, moves, and retirements without changing live paths.
2. Rewrite unambiguous link targets deterministically for pure renames.
3. Route ambiguous inbound references through explicit page-edit candidates.
4. Require merge/split destination content and source citations to validate before source-page retirement.
5. Reject any end state with broken inbound links, duplicate targets, uncatalogued pages, or unsafe paths.

### 7. Make index maintenance deterministic

1. Define a clear generated catalog boundary in the bundled schema and index format.
2. Render catalog entries from validated semantic metadata in Build/change plans.
3. Preserve manual index text outside the generated section verbatim.
4. Migrate existing indexes conservatively and fail without overwrite when their structure cannot be reconciled safely.

### 8. Migrate Query

1. Stream the final briefing as ordinary text rather than JSON-escaped content.
2. Require inline Character Mind wikilinks for citations.
3. Derive `wikiPages` and `rawSources` from cited links intersected with actual read/verified-raw traces.
4. Preserve the read-only operation boundary and compact Marinara-authored query log.

### 9. Migrate Lint and repair

1. Expand deterministic structural checks where intended repairs are unambiguous.
2. Have the LLM return a small semantic repair plan rather than mutate files directly.
3. Execute repairs through the common staged edit/topology pipeline.
4. Commit all repairs together or leave the visible wiki unchanged.
5. Preserve automatic lint cadence only after the new operation proves resumable and conflict-safe.

### 10. Add commit, conflict, and recovery handling

1. Recheck live hashes and topology preconditions immediately before commit.
2. Return a stable conflict result when relevant manual edits changed the operation base.
3. Persist before-images and the intended before/after hash journal.
4. Apply staged file changes with existing atomic per-file replacement primitives.
5. Roll back applied files if a later commit step or visible-tree validation fails.
6. Recover unfinished journals on server startup or before the next operation for that mind.
7. Include `.marinara/` state in backup, restore, and deletion behavior.

### 11. Update prompts, schema, controls, and observability

1. Rewrite the bundled `SCHEMA.md` workflows and operation prompts to match the approved contracts.
2. Remove instructions naming obsolete live write tools.
3. Surface resumable staged work and manual-edit conflicts through the existing Character Mind status/modal without adding a wiki editor.
4. Keep `log.md` human-readable and append entries only for planning/candidate failures, conflicts, commit outcomes, Query, and Lint outcomes needed for diagnosis.
5. Ensure Phoenix tracing distinguishes request retries, candidate attempts, resume, validation, conflict, commit, and recovery without exposing more content than current raw-stream opt-in behavior already permits.

### 12. Add focused deterministic validation

1. Extend the Character Mind regression rather than creating a parallel broad harness.
2. Cover new-page streamed output, explicit replacement, bounded exact edits, duplicate/no-match edit correction, and rejection of large content tool arguments.
3. Cover corpus-map and incremental-plan validation, including an initially unknown affected-page count that becomes frozen before editing.
4. Cover merge, split, rename, retirement, inbound-link closure, index rendering, and manual index-text preservation.
5. Inject provider failure before response bytes, after partial ordinary text, after completed candidate staging, and during a later page session.
6. Cover cancellation, process-style resume, source/base mismatch replanning, and bounded failure exhaustion.
7. Inject commit failure after one or more file replacements and verify rollback/recovery.
8. Edit a live page and `SCHEMA.md` during an operation and verify conflict without overwrite.
9. Cover safe legacy CR029 checkpoint import and unsafe-checkpoint fallback without premature synthesis deletion.
10. Preserve existing raw integrity, ownership, path, query grounding, and complete-wiki regressions.

## Expected application files

The exact split may change during implementation, but the work is expected to center on:

- `packages/server/src/services/character-mind/character-mind.constants.ts`
- `packages/server/src/services/character-mind/character-mind.files.ts`
- `packages/server/src/services/character-mind/character-mind.log.ts`
- `packages/server/src/services/character-mind/character-mind.plan.ts`
- `packages/server/src/services/character-mind/character-mind.runtime.ts`
- `packages/server/src/services/character-mind/character-mind.service.ts`
- `packages/server/src/services/character-mind/character-mind.tools.ts`
- new focused staging/commit helpers below `packages/server/src/services/character-mind/` if keeping those responsibilities separate improves clarity
- `packages/server/src/routes/character-minds.routes.ts`
- Character Mind shared contracts under `packages/shared/`
- `packages/client/src/hooks/use-character-minds.ts`
- `packages/client/src/components/chat/CharacterMindModal.tsx`
- `scripts/regressions/character-mind.regression.ts`
- backup/restore or deletion services only where required to include private operation state

Before editing client files, read `packages/client/.instructions.md` in the CR worktree.

## Verification

Use proportional validation once implementation is complete:

1. Run the focused Character Mind deterministic regression, including failure injection and crash-recovery simulations.
2. Run server and shared TypeScript validation during focused development as needed.
3. Run changed-file client lint if the existing modal or hook changes.
4. Run `pnpm check` once as the baseline cross-cutting validation because the change spans shared contracts, server runtime/storage, and likely client status handling.
5. Run the production build in the primary application checkout after approved implementation is merged there for manual validation.
6. Agree with the user whether to add focused Playwright E2E validation after the behavior-bearing implementation is complete.

No database schema push or version check is expected unless implementation expands into those areas.

## Rollback

- Revert the CR030 application commit(s) to restore CR029's direct-write runtime and Build checkpoint behavior.
- Do not delete raw sources, visible wiki pages, index, schema, or log during rollback.
- Private `.marinara/` work/journal data may remain inert under the old runtime; provide a focused cleanup or compatibility read only if implementation proves it is required for safe downgrade.
- If a commit journal exists at downgrade time, complete CR030 recovery before running the older runtime.

## Approval gate

Implementation begins only after the user approves `HLD.md` or gives a direct instruction to implement the approved design. Any material change to the mutation boundary, manual-edit conflict policy, index ownership, or commit guarantee returns to HLD review before coding.

