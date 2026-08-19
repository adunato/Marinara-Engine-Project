# CR037 Implementation Plan — Stateful Two-Pass Context Briefing

## Status

Draft implementation plan awaiting HLD approval.

## Prerequisites

- Approve HLD.md.
- Preserve the existing CR032 Two-Pass pipeline boundary, shared-source resolution, and writer isolation.
- Perform all application work from a dedicated temporary worktree on `change/CR037-stateful-two-pass-context`.
- Read `Marinara-Engine/CONTRIBUTING.md` and `Marinara-Engine/packages/client/.instructions.md` before application edits.
- Preserve Standard Conversation generation and the existing CR032 stateless Two-Pass mode as baselines.

## Atomic Tasks

### 1. Add shared settings and metadata contracts

1. Add typed chat metadata for the persistent context briefing.
2. Add a Two-Pass mode selector that distinguishes:
   - Stateless (CR032)
   - Stateful (this CR)
3. Add typed settings for the fast-path threshold and curation agent connection override if needed.
4. Add a typed **per-source role map** keyed by the closed set of context source identifiers defined in the HLD (`characterCard`, `persona`, `conversationStatus`, `commands`, `reactRules`, `replyRules`, `memories`, `dailyMemories`, `dailyIntentions`, `lorebook`, `summaries`, `crossChatAwareness`, `roleplayScenes`, `characterMind`, `recentExchange`), with role values `always_include` / `agent_curated` / `always_exclude` and the HLD defaults.
5. Enforce the `recentExchange` invariant (cannot be `always_exclude`) and unavailable-source handling in normalization.
6. Preserve backward-compatible parsing for chats without the new metadata (apply defaults).

### 2. Add persistent briefing storage and lifecycle

1. Add a dedicated per-chat storage location for the persistent briefing (chat metadata or a dedicated per-chat context file).
2. Include the briefing in chat CRUD, duplication, export/import, and backup/restore.
3. Survive server restart.
4. Provide a reset action that clears the briefing.

### 3. Add batched source-tool infrastructure

1. Define a tool registry for read-only source access covering every source in the HLD enumeration.
2. Register only sources whose configured role is **Agent curated**; do not register **Always include** or **Always exclude** sources.
3. Resolve all **Always include** sources up front and pack them into a labeled, immutable `## Injected Sources` block merged into the briefing before the curation agent runs.
4. Implement a single batched invocation that runs all requested curated-tool lookups in parallel and returns a combined delimited result block.
5. Ensure each tool result is bounded, attributed, and explicit.
6. Reuse existing retrieval logic where possible without changing Standard behavior.

### 4. Implement the fast-path classifier

1. Add a lightweight first-step curation prompt that classifies the turn as routine or significant.
2. Output a structured decision (fast path, sections to update, reason).
3. On fast path, skip batched tool calls and lightly update the briefing.
4. On full path, proceed to source selection and batched tool call.

### 5. Implement the multi-shot curation agent

1. Replace or extend the CR032 single-shot curator.
2. Load the previous briefing and the current turn delta.
3. Run the fast-path classifier.
4. If full path is needed, build a batched tool request, execute it, and receive the combined result.
5. Update the briefing in place.
6. Persist the updated briefing.
7. Pass the briefing to the response writer.

### 6. Preserve writer isolation

1. Ensure the writer receives only the updated briefing and the writer system prompt.
2. Add structural guardrails so raw cards, summaries, memories, lore, and awareness cannot leak into the writer request.
3. Add tests to verify the isolation invariant.

### 7. Add UI for optional inspection

1. Add a **View Context Briefing** action in Conversation Chat Settings or the message menu.
2. Add a read-only panel showing the current briefing.
3. Add a **Reset** button to clear it.
4. Add a **Context Sources** panel listing every source with a three-state role selector (Always include / Agent curated / Always exclude), unavailable badges for globally disabled sources, the `recentExchange` exclude-disabled treatment, per-source descriptions, and a **Reset to defaults** action.
5. Add generation metadata showing fast/full path, batched tools used, and which sources were injected as Always include.

### 8. Add diagnostics and metadata

1. Record the active curation mode (stateless vs. stateful), path taken (fast/full), and batched tools called.
2. Extend Peek Prompt / debug surfaces to show the persistent briefing, the delta, and the updated briefing.
3. Keep the briefing out of the visible transcript.

### 9. Add focused regression coverage

1. Prove Standard generation is unaffected.
2. Prove existing CR032 stateless Two-Pass still works when selected.
3. Prove stateful mode persists and loads the briefing across turns.
4. Prove fast path skips batched tool calls for routine messages.
5. Prove full path issues one batched tool request scoped to **Agent curated** sources and updates the briefing.
6. Prove **Always include** sources are injected and preserved unchanged across fast and full paths.
7. Prove **Always exclude** sources are never resolved or registered.
8. Prove the writer receives only the briefing and system prompt.
9. Prove reset clears the briefing.
10. Prove the per-source role map persists across duplication, export/import, and backup/restore, and restores an unavailable source's prior role when it becomes available again.
11. Prove no write-back to memories, summaries, lore, or other stores.

### 10. Document and validate

1. Update docs for Two-Pass Chat Settings, the persistent briefing, and the new diagnostics.
2. Run focused regressions and `cd Marinara-Engine && pnpm check` once.
3. After integration into the primary checkout, run the production build there before manual validation.
4. After implementation, agree with the user whether focused Playwright E2E validation should be created with the Marinara E2E skill.

## Expected Files and Areas

- `packages/shared/src/types/chat.ts`
- `packages/shared/src/types/prompt.ts`
- shared metadata / chat normalization helpers
- `packages/server/src/db/schema/` or chat metadata storage layer
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
2. Existing CR032 stateless Two-Pass continues to work.
3. Stateful Two-Pass persists and updates the briefing across turns.
4. Fast path runs for routine turns without batched tool calls.
5. Full path issues one batched source request and updates the briefing.
6. The writer receives only the briefing and its system prompt.
7. Reset clears the briefing.
8. Export/import and backup/restore preserve the briefing.
9. No write-back to memories, summaries, lore, or other stores.
10. Focused regressions and `pnpm check` pass once.

## Rollback

Revert the CR037 application commits. Chats with stateful Two-Pass enabled fall back to stateless Two-Pass or Standard generation depending on their stored pipeline selection. The persistent briefing metadata can be ignored by older code or treated as opaque. No chat messages, memories, summaries, or Character Mind data require migration or deletion.

## Approval Gate

Implementation is pending HLD approval. Material scope changes (e.g., adding a third model call, writing back to real stores, extending to Standard or Roleplay, or removing the CR032 stateless option) require explicit approval.
