# CR047 — Implementation Plan

_Status: Planning complete; approved for implementation._

## 1. Prerequisites

- CR042 Character Daily Memories is available on the staging base.
- CR044 Character Briefing and its `search_character_daily_memories` tool are
  available on the staging base.
- The current staging retrieval boundary is
  `packages/server/src/services/character-daily-memories/retrieval.service.ts`;
  `createCharacterDailyMemoryRetrievalService().searchForCharacter()` already
  loads the character-owned active pool, persisted weights/threshold, and
  embedding source. The current implementation has no persisted result-limit
  setting, so this CR must remove its default cap rather than invent a
  tool-only cap. Its recency half-life remains the existing implementation
  default unless a later CR persists that control.
- The Preview route's `previewRetriever` callback is an existing adapter seam.
  Staging has no Character Daily Memory Chat adapter yet: the implementation
  must add a thin adapter at
  `packages/server/src/routes/generate/conversation-history-runtime.ts`
  (`prepareConversationPromptHistory`), called from the Conversation branch
  of `generate.routes.ts`. The generic `memory-recall` path is a separate
  feature and must not be mistaken for this adapter.
- Create the dedicated application worktree and branch
  `change/CR047-memory-retrieval-consistency` from local `staging`.

## 2. Atomic Tasks

1. Trace and, where necessary, normalize the persisted character retrieval
   settings at the retrieval service boundary; do not duplicate defaults in a
   caller.
2. Make the Preview route's existing `previewRetriever` seam call the shared
   retrieval service, preserving its current response shape and UI.
3. Add the Conversation adapter at `prepareConversationPromptHistory`. For
   each enabled character in the current Conversation, take the last configured
   `N` visible messages, derive the retrieval query in chronological order, and
   call the shared character retrieval service. Inject distinct
   character-labelled blocks while preserving safe degradation.
4. Route Character Briefing's `search_character_daily_memories` callback
   through the same retrieval service, retaining the dedicated LLM-generated
   query and host-owned character scope. Keep retrieval parameters out of the
   model-facing schema.
5. Remove the retrieval service's default result cap and keep ranking,
   threshold, active-run, character-scope, and embedding-space rules shared by
   Preview, Chat, and Briefing.
6. Add privacy-safe trace metadata (caller, scope kind, candidate/eligible/
   returned counts, and availability) without recording memory contents or raw
   queries.
7. Preserve legacy `extensions.characterMemories` and generic `memory-recall`
   behavior as separate implementations. Add focused server regressions for
   policy parity, settings, scope, no-cap results, empty/unavailable results,
   and both query-source contracts.
8. Run focused checks, the required staging build/checks, and inspect the final
   diff before handing off for review and validation.

## 3. Expected Files/Surfaces

Exact paths require codebase inspection during planning. Expected surfaces are:

- `packages/server/src/services/character-daily-memories/retrieval.service.ts`
  (shared retrieval, ranking, settings, scope, embedding-space, and no-cap
  policy);
- `packages/server/src/services/storage/character-daily-memories.storage.ts`
  and `packages/shared/src/types/character-daily-memory.ts` (persisted
  settings/defaults, only if normalization requires a compatible correction);
- `packages/server/src/routes/character-daily-memories.routes.ts` (Preview
  `previewRetriever` adapter and response mapping);
- `packages/server/src/routes/generate/conversation-history-runtime.ts`
  (`prepareConversationPromptHistory` Chat adapter/query derivation and
  character-labelled context injection), with its call site in
  `packages/server/src/routes/generate.routes.ts`;
- `packages/server/src/services/character-briefing.service.ts`,
  `packages/server/src/services/tools/tool-executor.ts` (Briefing adapter and
  existing tool response contract);
- corresponding shared tool manifest, server tests, and focused trace tests;
- focused server/unit/regression tests and any narrowly relevant docs.

No changes are planned to legacy character-card memory storage, unrelated
agent tools, or the Character Briefing editor/parser.

## 4. Verification

- Run the focused retrieval parity regression with a fixture corpus containing
  known semantic, importance, and recency scores and enough records to prove
  there is no implicit result cap.
- Verify equivalent Preview, Chat, and Briefing queries return the same records
  in the same order under the same character-owned active-memory scope.
- Verify changing each persisted setting affects all three callers and no
  caller can override it through tool arguments.
- Verify no caller or shared service applies an undocumented result cap and
  that all records meeting the shared threshold remain eligible.
- Verify missing index/backend and empty corpus behavior follows the existing
  structured availability/safe-degradation contract.
- Run the smallest applicable typecheck/lint/test checks, then the staging
  production build; run `pnpm db:push` only if implementation touches schema.
- Inspect `git diff --check` and ensure no unrelated files or worktree changes
  are included.

## 5. Rollback

Revert the CR047 application commit(s) or reset the dedicated CR047 worktree to
the pre-change staging base. Persisted retrieval settings and existing memory
records must remain readable; any schema migration must include a backward-
compatible default and an explicit rollback note.

## 6. Handoff

After planning confirms the exact file-level design, implementation proceeds in
the dedicated worktree. Review and validation must confirm the shared-boundary
invariant before local integration into `staging`.
