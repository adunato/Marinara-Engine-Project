# CR019 Implementation Plan

Status: Proposed

## Prerequisites

- Base application work on nested `Marinara-Engine/main` using `change/CR019-compiled-character-mind` and a dedicated temporary worktree.
- Obtain approval for `HLD.md` before application implementation because the fixed grammar, update semantics, appraisal latency, and first-release UI scope materially affect the feature.
- Read `AGENTS.md`, `Marinara-Engine/CONTRIBUTING.md`, and `Marinara-Engine/packages/client/.instructions.md` before editing application or client code.
- Trace CR015 Daily Memories formation, persistence, embeddings, retrieval, settings, and editor paths.
- Trace CR016 Daily Intentions eligibility, offline context snapshot, managed-agent settings, current-state editor, and prompt injection paths.
- Confirm file-native replacement and cascade conventions for one bounded per-Conversation mind document.

## Atomic Tasks

1. Define the shared Compiled Character Mind agent identifier, fixed concept types, fixed association kinds, statuses, source-reference types, link types, operation types, appraisal contract, and API response types.
2. Register the feature as an opt-in managed built-in agent allowed only in Conversation mode.
3. Add and test the single-character eligibility rule while preserving stored state when a chat becomes temporarily ineligible.
4. Add one file-native `character_minds` table containing the bounded mind document, source cursor/fingerprint, and timestamps; register table metadata and chat/character cascades.
5. Implement whole-document normalization and validation for concept identity, association bounds, evidence references, related concepts, conflicts, active/superseded state, item counts, and serialized size.
6. Implement a Conversation-scoped mind service with list, inspect, create/edit/delete, clear, initial-build, rebuild, and reorganization operations.
7. Reuse the existing embedding source and text-embedding utilities for changed association values, storing optional embeddings inside the bounded document and using direct in-process scoring rather than a separate index.
8. Implement consolidation runtime resolution using one selected connection with normal agent fallback behaviour.
9. Build the daily consolidation snapshot from character-card priors, newly unprocessed persisted Daily Memories, relevant existing concepts/associations, and a compact active-concept index.
10. Implement structured consolidation parsing and an application-controlled reducer for create, reinforce, weaken, revise, supersede, link, and unlink operations.
11. Apply a validated consolidation batch to an in-memory copy, atomically replace the one stored document, and advance the processed-day cursor only after complete success.
12. Bound automatic catch-up work per reply and retain failed days for later retry without blocking normal generation.
13. Implement initial build and destructive rebuild from the current character card plus all persisted Daily Memories, replacing prior compiled state only after a complete successful candidate build.
14. Implement bounded user-triggered reorganization over existing compiled state without modifying source memories or the character card.
15. Implement current-context activation using direct concept matching, semantic relevance, strength, confidence, evidence importance/recency, and one bounded related/conflict expansion.
16. Implement the transient appraisal call, validate its structured output, and ensure it cannot persist state or generate the final dialogue.
17. Inject a clearly delimited, character-identified appraisal block into eligible normal Conversation generation and fail open when activation or appraisal fails.
18. Ensure consolidation and appraisal inputs exclude previous appraisals, Daily Intentions output, hidden-from-AI messages, and generated model-maintenance instructions.
19. Add routes for reading state, saving manual edits, building/rebuilding, reorganizing, clearing, and previewing activation/appraisal.
20. Add a minimal managed-agent setting for the shared consolidation/appraisal connection without generic ontology, graph, or tuning controls.
21. Add a Conversation-level Compiled Character Mind editor with searchable concepts, association cards, kind/content, strength, confidence, status, source references, manual edit/delete, build/rebuild, reorganize, clear, and preview actions.
22. Mark user-authored compiled associations distinctly and preserve them through ordinary daily consolidation unless the user deletes them or a later explicit edit changes them.
23. Add focused shared/server/client tests for grammar validation, state transitions, provenance, isolation, consolidation cursors, transactional failure, activation, conflicting associations, transient appraisal, prompt injection, UI editing, and destructive-action confirmation.
24. Run `pnpm db:push` and `pnpm check` once, record results, and fix only failures attributable to CR019.
25. After behaviour is complete, ask whether to add focused CR019 Playwright E2E validation through `$marinara-e2e-validation`.
26. Commit the completed application branch, merge it into the requested local branch after validation, update `change_requests/tracker.md`, and remove the temporary worktree.

## Expected Files and Areas

Exact paths should be finalized after implementation tracing. Expected areas include:

- `packages/shared/src/features/agents/core-agent-manifests.ts`
- Shared Compiled Character Mind types and API contracts
- `packages/server/src/db/schema/chats.ts` or a focused adjacent schema module for one mind-document table
- `packages/server/src/db/file-backed-store.ts`
- A new service under `packages/server/src/services/conversation/`
- A focused runtime resolver under `packages/server/src/services/generation/`
- A new route module registered through `packages/server/src/routes/index.ts`
- Conversation orchestration in `packages/server/src/routes/generate.routes.ts` or a narrower extracted helper
- Existing embedding utilities shared with Daily Memories and Memory Recall
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- A focused Compiled Character Mind editor/preview component
- A client query/mutation hook
- Focused shared, server, and client tests
- Optional parent Playwright tests under `tests/e2e/specs/change-requests/CR019/` only after user agreement
- Parent-only `change_requests/CR019_compiled_character_mind/` documentation and tracker bookkeeping

## Verification

- Activate the agent for two separate Conversations using the same card and confirm their minds remain isolated.
- Form or seed Daily Memories and confirm consolidation creates only validated concepts and associations with exact source references.
- Feed supporting evidence and confirm bounded reinforcement without duplicate association creation.
- Feed contradicting evidence and confirm weakening or an explicit conflicting association without destructive flattening.
- Revise and supersede associations while retaining inspectable provenance and status.
- Confirm routine low-value memories may produce no durable update.
- Confirm a malformed or over-limit consolidation batch performs no replacement and does not advance the cursor.
- Confirm a successful rebuild atomically replaces compiled state and a failed rebuild leaves it unchanged.
- Confirm manual associations are clearly marked and not silently removed by routine consolidation.
- Confirm activation returns a bounded relevant subset and includes directly linked conflicting state when appropriate.
- Confirm appraisal uses the activated state, remains transient, and does not appear in later consolidation inputs.
- Confirm ordinary replies continue when consolidation, embeddings, activation, or appraisal are unavailable.
- Confirm disabling or removing the agent preserves state, while explicit clear and chat deletion remove it as described.
- Confirm editor behaviour at desktop and mobile widths, including empty/loading/error states and destructive confirmations.
- Run `pnpm db:push` for the new file-native schema.
- Run `pnpm check` once as the baseline cross-cutting validation.
- If the user approves focused E2E, cover build, consolidation, contradictory evidence, appraisal injection, manual editing, rebuild preservation, isolation, and failure degradation.

## Rollback

- Disable or remove the Compiled Character Mind built-in agent registration and runtime hooks.
- Remove its routes and UI entry points while leaving Daily Memories, Daily Intentions, Memory Recall, summaries, and ordinary Conversation generation unchanged.
- Preserve dedicated persisted tables during a temporary feature rollback unless an explicit migration safely removes them.
- Revert CR019 application commits without reverting CR015, CR016, or unrelated user changes.
