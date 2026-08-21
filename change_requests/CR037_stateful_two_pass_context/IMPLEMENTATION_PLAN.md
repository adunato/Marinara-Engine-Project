# CR037 Implementation Plan — Stateful Two-Pass Context Briefing

## Status

Draft implementation plan awaiting HLD approval.

## Prerequisites

- Approve HLD.md.
- Preserve the existing CR032 Two-Pass pipeline boundary and writer isolation while replacing its stateless curator behavior with CR037's persistent stateful briefing.
- Perform all application work from a dedicated temporary worktree on `change/CR037-stateful-two-pass-context`.
- Read `Marinara-Engine/CONTRIBUTING.md` and `Marinara-Engine/packages/client/.instructions.md` before application edits.
- Preserve Standard Conversation generation unchanged.
- Treat the HLD source registry as the authoritative CR037 context-source set. Do not automatically inherit every context block present in the CR032 prepared-context snapshot.

## Atomic Tasks

### 1. Add shared settings and metadata contracts

1. Add typed chat metadata for the persistent context briefing.
2. Replace the CR032 stateless Two-Pass curator behavior with the CR037 stateful briefing flow; do not add a separate Stateless/Stateful selector.
3. Add typed settings for the fast-path classifier connection and curation agent connection override as defined in the HLD.
4. Add a typed **per-source role map** keyed by the closed set of context source identifiers defined in the HLD (`characterCard`, `persona`, `conversationStatus`, `commands`, `reactRules`, `replyRules`, `memories`, `dailyMemories`, `dailyIntentions`, `lorebook`, `summaries`, `crossChatAwareness`, `roleplayScenes`, `characterMind`, `recentExchange`), with role values `always_include` / `agent_curated` / `always_exclude` and the HLD defaults.
5. Enforce the `recentExchange` invariant (cannot be `always_exclude`) and unavailable-source handling in normalization.
6. Preserve backward-compatible parsing for chats without the new metadata by applying defaults.

### 2. Add persistent briefing storage and lifecycle

1. Store the persistent briefing in chat metadata, matching the HLD.
2. Include the briefing in chat CRUD, duplication, export/import, and backup/restore.
3. Survive server restart.
4. Provide a reset action that clears the briefing.
5. Track whether the current BRIEFING is valid. The following conditions invalidate it and require an empty-shell full build before the writer runs:
   - first use of CR037;
   - manual reset;
   - daily rebuild;
   - a previously contributing source changing to **Always exclude**;
   - a previously contributing source becoming unavailable.
6. Retain a source's configured role while unavailable so it is restored if the source becomes available again.

### 3. Add batched source-tool infrastructure

1. Define a tool registry for read-only source access covering every source in the HLD enumeration.
2. Register only sources whose configured role is **Agent curated**; do not register **Always include** or **Always exclude** sources.
3. Resolve all **Always include** sources up front and pack them into the immutable SOURCES section before the curation agent runs.
4. Implement a single batched invocation that runs all requested curated-tool lookups in parallel and returns a combined delimited result block.
5. Ensure each tool result is bounded, attributed, and explicit.
6. Reuse existing retrieval logic where possible without changing Standard behavior.
7. Do not automatically pass through CR032-only prompt inputs that are not represented in the CR037 source registry; adding new source types is a separate tracked change.

### 4. Implement the fast-path classifier

1. Add a lightweight first-step curation prompt that classifies a turn as routine or significant.
2. Output exactly the HLD decision shape: `{ fastPath, reason }`.
3. Only run the classifier when a valid prior BRIEFING exists.
4. On fast path, skip batched tool calls and lightly update the allowed briefing sections.
5. On full path, proceed to source selection and the batched tool call.
6. On first use, reset, daily rebuild, or source invalidation, skip the classifier entirely and force a full build.

### 5. Implement the multi-shot curation agent

1. Replace the CR032 single-shot stateless curator with the CR037 stateful curator.
2. Load the previous valid briefing and the current turn delta.
3. If no valid prior briefing exists, start from an empty BRIEFING shell and force the full path.
4. If a valid prior briefing exists, run the fast-path classifier.
5. If full path is needed, build a batched tool request, execute it, and receive the combined result.
6. With a valid prior briefing, update only affected sections in place.
7. With a forced full build, populate the BRIEFING from the empty shell using only currently permitted sources; do not preserve text from the invalidated briefing.
8. Persist the updated briefing.
9. Pass the complete SOURCES + BRIEFING artifact to the response writer.

### 6. Preserve writer isolation

1. Ensure the writer receives only the complete briefing artifact and the writer system prompt.
2. Add structural guardrails so raw source data cannot bypass the CR037 briefing boundary.
3. Add tests to verify the isolation invariant.

### 7. Add UI for optional inspection

1. Add a **View Context Briefing** action in Conversation Chat Settings or the message menu.
2. Add a read-only panel showing the current briefing.
3. Add a **Reset** button to clear it.
4. Add a **Context Sources** panel listing every source with a three-state role selector (Always include / Agent curated / Always exclude), unavailable badges for globally disabled sources, the `recentExchange` exclude-disabled treatment, per-source descriptions, and a **Reset to defaults** action.
5. When a role change invalidates the current briefing, make the resulting rebuild behavior clear in the UI if needed.
6. Add generation metadata showing fast/full path, batched tools used, and which sources were injected as Always include.

### 8. Add diagnostics and metadata

1. Record the path taken (fast/full/forced full build), reason, and batched tools called.
2. Extend Peek Prompt / debug surfaces to show the prior briefing state, turn delta, source results, and updated briefing.
3. Keep the briefing out of the visible transcript.

### 9. Add focused regression coverage

1. Prove Standard generation is unaffected.
2. Prove CR037 replaces the CR032 stateless Two-Pass curator rather than adding a second Two-Pass mode.
3. Prove the briefing persists and loads across turns.
4. Prove fast path skips batched tool calls for routine messages when a valid prior briefing exists.
5. Prove first use forces a full build.
6. Prove reset forces a full build.
7. Prove the daily rebuild forces a full build.
8. Prove changing a previously contributing source to **Always exclude** invalidates the old briefing and rebuilds without that source.
9. Prove a previously contributing source becoming unavailable invalidates the old briefing, while retaining its configured role for later restoration.
10. Prove full path issues one batched tool request scoped to **Agent curated** sources and updates the briefing.
11. Prove **Always include** sources are injected and preserved unchanged across fast and full paths.
12. Prove **Always exclude** sources are never resolved or registered.
13. Prove the writer receives only the briefing and system prompt.
14. Prove the per-source role map persists across duplication, export/import, and backup/restore.
15. Prove group chats use one shared persistent briefing.
16. Prove no write-back to memories, summaries, lore, or other stores.

### 10. Document and validate

1. Update docs for Two-Pass Chat Settings, the persistent briefing, explicit CR037 source registry, and diagnostics.
2. Document that CR037 intentionally does not automatically inherit all CR032 prepared-context inputs; additional sources require a tracked registry change.
3. Run focused regressions and `cd Marinara-Engine && pnpm check` once.
4. After integration into the primary checkout, run the production build there before manual validation.
5. After implementation, agree with the user whether focused Playwright E2E validation should be created with the Marinara E2E skill.

## Expected Files and Areas

- `packages/shared/src/types/chat.ts`
- `packages/shared/src/types/prompt.ts`
- shared metadata / chat normalization helpers
- chat metadata storage layer
- `packages/server/src/routes/generate/` or `packages/server/src/services/generation/` for the curation agent, source tool registry, and briefing lifecycle
- `packages/server/src/services/prompt/` for briefing-aware prompt construction
- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- `packages/client/src/components/chat/PeekPromptModal.tsx`
- affected client API/store types and chat metadata helpers
- focused regression scripts/tests
- Two-Pass and Chat Settings documentation

No Character Mind runtime changes, Daily Memory format changes, Daily Intentions format changes, release metadata changes, dependency changes, or version changes are expected.

## Verification

1. Standard Conversation generation remains unchanged.
2. CR037 replaces the CR032 stateless curator within Two-Pass generation.
3. Stateful Two-Pass persists and updates the briefing across turns.
4. Fast path runs only when a valid prior briefing exists.
5. First use, reset, daily rebuild, and source invalidation force a full build.
6. Full path issues one batched source request scoped to Agent Curated sources and updates the briefing.
7. The writer receives only the briefing and its system prompt.
8. Export/import and backup/restore preserve the briefing and source-role map.
9. Group chats use one shared briefing.
10. No write-back to memories, summaries, lore, or other stores.
11. Focused regressions and `pnpm check` pass once.

## Rollback

Revert the CR037 application commits. Older code may ignore the persistent briefing metadata as opaque data. Standard Conversation generation remains available and unchanged. No chat messages, memories, summaries, or Character Mind data require migration or deletion.

## Approval Gate

Implementation is pending HLD approval. Material scope changes (for example adding a third model call, writing back to real stores, extending to Standard or Roleplay, changing the shared group-briefing decision, or adding new context-source types beyond the approved registry) require explicit approval.
