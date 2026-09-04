# CR047 — Implementation Plan

_Status: Intake complete; ready for planning._

## 1. Prerequisites

- CR042 Character Daily Memories is available on the staging base.
- CR044 Character Briefing and its `search_character_daily_memories` tool are
  available on the staging base.
- Confirm the existing persisted Memories-tab retrieval configuration and the
  current Preview, Chat, and Briefing call paths during planning.
- Create the dedicated application worktree and branch
  `change/CR047-memory-retrieval-consistency` from local `staging`.

## 2. Atomic Tasks

1. Trace the existing persisted retrieval settings, normalization/defaults,
   corpus/index lookup, and ranking/filtering implementation.
2. Define a small shared server-side retrieval boundary that accepts the
   caller's query and owning scope while applying the persisted policy.
3. Move or adapt Memories Preview to use the boundary without changing its
   manual-query UX.
4. Route Conversation Daily Memory retrieval through the boundary while
   retaining last-`N` message query derivation.
5. Route Character Briefing tool retrieval through the boundary while retaining
   its dedicated LLM-generated query and no model-supplied tuning parameters.
6. Preserve legacy `extensions.characterMemories` behavior as a separate
   implementation and update only relevant documentation/comments if needed.
7. Add focused server regressions for policy parity, settings, scope, limits,
   empty/unavailable results, and both tool/query-source contracts.
8. Run focused checks, the required staging build/checks, and inspect the final
   diff before handing off for review and validation.

## 3. Expected Files/Surfaces

Exact paths require codebase inspection during planning. Expected surfaces are:

- CR042 Daily Memory persistence/settings and shared retrieval service;
- Memories tab Preview Retrieval server route and client adapter, if Preview
  currently bypasses the shared service;
- Conversation Daily Memory context assembly;
- CR044 Character Briefing memory tool and its service adapter;
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
