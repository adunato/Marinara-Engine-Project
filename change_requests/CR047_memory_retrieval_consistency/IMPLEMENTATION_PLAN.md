# CR047 — Implementation Plan

_Status: Planning complete; approved for implementation._

## 1. Prerequisites

- CR042 Character Daily Memories is available on the staging base.
- CR044 Character Briefing and its `search_character_daily_memories` tool are
  available on the staging base.
- The existing canonical retrieval implementation is
  `packages/server/src/services/conversation/daily-memory.service.ts`;
  `retrieveDailyMemories` already applies semantic, importance, recency,
  minimum-rank, and recency-half-life settings. There is currently no persisted
  result-limit setting, so this CR must not invent a tool-only cap.
- Confirm the existing Preview, Chat, and Briefing call paths against the LLD
  before editing; the observed Briefing empty-array defect is an adapter/scope
  mismatch, not a reason to create a second retrieval algorithm.
- Create the dedicated application worktree and branch
  `change/CR047-memory-retrieval-consistency` from local `staging`.

## 2. Atomic Tasks

1. Trace and, where necessary, normalize the persisted retrieval settings and
   runtime resolver once; do not duplicate defaults in a caller.
2. Make the Preview route use `retrieveDailyMemories` with the selected
   character/chat scope and the manual query, preserving its existing response
   shape and UI.
3. Route Conversation Daily Memory retrieval through the same function and
   settings resolver while retaining last-`N` message query derivation.
4. Route Character Briefing's `search_character_daily_memories` adapter through
   the same function, passing the host-owned character's Daily Memory chat
   scope and its dedicated generated query. Keep retrieval parameters out of
   the model-facing schema.
5. Add privacy-safe trace metadata (caller, scope kind, query/result counts,
   availability, and policy version/values as appropriate) without recording
   memory contents or raw queries.
6. Preserve legacy `extensions.characterMemories` behavior as a separate
   implementation and update only relevant documentation/comments if needed.
7. Add focused server regressions for policy parity, settings, scope, limits,
   empty/unavailable results, and both tool/query-source contracts.
8. Run focused checks, the required staging build/checks, and inspect the final
   diff before handing off for review and validation.

## 3. Expected Files/Surfaces

Exact paths require codebase inspection during planning. Expected surfaces are:

- `packages/server/src/services/conversation/daily-memory.service.ts` (shared
  retrieval and settings normalization);
- `packages/server/src/services/generation/daily-memory-agent-runtime.ts`
  (persisted settings/runtime resolution);
- `packages/server/src/routes/daily-memories.routes.ts` (Preview Retrieval);
- `packages/server/src/routes/generate.routes.ts` and
  `packages/server/src/services/generation/conversation-*` (Chat query and
  context assembly);
- `packages/server/src/services/character-briefing.service.ts`,
  `packages/server/src/routes/character-briefing.routes.ts`, and
  `packages/server/src/services/tools/tool-executor.ts` (Briefing adapter);
- corresponding shared tool manifest, server tests, and focused trace tests;
- focused server/unit/regression tests and any narrowly relevant docs.

No changes are planned to legacy character-card memory storage, unrelated
agent tools, or the Character Briefing editor/parser.

## 4. Verification

- Run the focused retrieval parity regression with a fixture corpus containing
  known semantic, importance, and recency scores and a constrained limit.
- Verify equivalent Preview, Chat, and Briefing queries return the same records
  in the same order under the same character/user scope.
- Verify changing each persisted setting affects all three callers and no
  caller can override it through tool arguments.
- Verify no caller applies an undocumented result cap and that all records
  meeting the shared threshold remain eligible.
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
