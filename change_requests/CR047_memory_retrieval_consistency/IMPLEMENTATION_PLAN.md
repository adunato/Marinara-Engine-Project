# CR047 — Implementation Plan

_Status: Implemented and merged into local staging._

## 1. Prerequisites

- CR042 Character Daily Memories and CR044 Character Briefing are present on
  local `staging`.
- The shared retrieval boundary is
  `packages/server/src/services/character-daily-memories/retrieval.service.ts`.
  `searchForCharacter({ characterId, query, ... })` owns settings loading,
  character scope, active-memory filtering, embedding-space validation,
  ranking, thresholding, and result selection.
- Preview is implemented in
  `packages/server/src/routes/character-daily-memories.routes.ts` and already
  selects the last configured `retrievalMessageCount` visible messages.
- The Chat custom tool host path and the Character Briefing tool host path are
  retained. They must both call the shared retrieval service; neither may
  provide policy overrides.
- Create/use the dedicated application branch
  `change/CR047-tool-retrieval-correction` from local `staging`.

## 2. Required reversal from the prior CR047 commit

Before implementing the corrected tool parity, remove the previous
Conversation-boundary implementation from `f6d017398`:

1. Remove the Character Daily Memory imports and retrieval helper from
   `packages/server/src/routes/generate/conversation-history-runtime.ts`.
2. Remove `dailyMemoryCharacterId`, `dailyMemoryBlock`, and any related
   arguments/return values from `prepareConversationPromptHistory`.
3. Remove the `dailyMemoryBlock` insertion into `finalMessages` in
   `packages/server/src/routes/generate.routes.ts`.
4. Restore ordinary Conversation prompt assembly so it does not retrieve or
   inject Character Daily Memories.

This reversal is mandatory and is part of CR047 acceptance, not optional cleanup.

## 3. Atomic implementation tasks

1. Inspect the Chat custom tool host path and identify its existing query
   preparation from the last configured `retrievalMessageCount` visible
   messages. Preserve that path and adjust only its callback/wiring to call
   `searchForCharacter` with the owning character ID and `caller: "conversation"`.
2. Verify Preview's adapter calls the same retrieval service with
   `caller: "preview"`, preserving its current response mapping and selected
   Conversation query behavior.
3. Verify Character Briefing's existing callback in
   `packages/server/src/services/character-briefing.service.ts` calls the same
   service with the owning character ID and `caller: "briefing"`. Preserve
   the LLM-generated query and the query-only
   `search_character_daily_memories` manifest.
4. Normalize persisted retrieval settings once at the shared service boundary,
   using existing Character Daily Memory defaults. Keep semantic, importance,
   recency, and minimum-rank policy identical for all callers.
5. Remove any hidden/default caller cap. There is no persisted result-limit
   setting; return every record that passes shared eligibility and threshold
   rules.
6. Preserve structured unavailable/empty-result behavior and character-owned
   active-memory/embedding-space scope. Do not read legacy
   `extensions.characterMemories` or generic `memory-recall` records.
7. Add privacy-safe diagnostics if the existing boundary requires them:
   caller, scope kind, availability, candidate/eligible/returned counts. Do not
   log raw queries or memory contents.
8. Add focused server regressions for the shared boundary, tool parity, query
   source differences, settings, scope, no-cap behavior, failure paths, and
   the absence of Conversation prompt-history retrieval/injection.

## 4. Expected files/surfaces

- `packages/server/src/services/character-daily-memories/retrieval.service.ts`:
  shared settings, scope, ranking, threshold, result selection, and diagnostics.
- `packages/server/src/routes/character-daily-memories.routes.ts`: Preview
  adapter and response mapping.
- Existing Chat tool route/service host surface discovered during implementation:
  preserve its custom tool callback and last-visible-message query derivation;
  do not move it into `conversation-history-runtime.ts`.
- `packages/server/src/services/character-briefing.service.ts`: Briefing host
  callback, dedicated generated query, and owning-character scope.
- `packages/server/src/services/tools/tool-executor.ts`: preserve the existing
  query-only tool execution contract.
- `packages/shared/src/features/function-calls/tools/search-character-daily-memories/manifest.ts`:
  verify `query` is the only model-facing argument.
- Focused server tests adjacent to the shared service and each tool adapter.
- `packages/server/src/routes/generate/conversation-history-runtime.ts` and
  `packages/server/src/routes/generate.routes.ts`: reversal only; no new
  retrieval behavior.

No client changes, schema migration, legacy character-memory changes, or E2E
specification are planned.

## 5. Verification

- Unit/service fixtures prove equivalent queries for one owning character yield
  identical IDs, order, threshold behavior, and counts through Preview, Chat,
  and Briefing.
- Chat tests prove the query contains only the last configured `N` visible
  messages, excluding hidden, empty, and non-visible messages.
- Briefing tests prove the query comes from the LLM tool call and its schema
  exposes no settings, limits, user scope, or character scope arguments.
- Settings tests prove semantic, importance, recency, and minimum-rank changes
  affect all callers identically.
- No-cap tests use more records than the old implicit cap and verify all
  threshold-eligible records are returned.
- Scope/availability tests cover other characters, inactive rows, mismatched
  embeddings, disabled settings, empty queries, and unavailable providers.
- Prompt assembly regressions prove `prepareConversationPromptHistory` has no
  Character Daily Memory retrieval or injected block.
- Run focused checks, then the staging production build, and inspect
  `git diff --check`. Run `pnpm db:push` only if implementation unexpectedly
  changes schema.

## 6. Rollback

Revert the corrected CR047 application commit(s) or reset the dedicated
worktree to the pre-CR047 staging base. No Daily Memory records or persisted
settings are modified, and no schema migration is expected.

## 7. Handoff

Implementation was performed in a dedicated nested worktree on
`change/CR047-tool-retrieval-correction` and integrated into local `staging` as
application commit `934e07d6d`. The corrected implementation removes the old
Conversation prompt-history retrieval/injection adapter and preserves the
existing Chat and Briefing tool paths on Preview's shared retrieval contract.

The staging production build passed after integration. Local `staging` is six
commits ahead of `origin/staging`; no remote push was performed. Focused
Playwright coverage was not agreed for this change.
