# CR058 Implementation Plan - Character Daily Memory Context Parity

_Status: Approved; implementation pending._

## 1. Prerequisites

- Use local application `main` containing CR042, CR047, and CR057.
- Create the dedicated nested application worktree and branch
  `change/CR058-character-daily-memory-context-parity` from local `main`.
- Read application contribution guidance and, before any client edit, the
  client instruction file.
- Trace the current Conversation and Roleplay generation paths, character
  target resolution, query inputs, prompt assembly, and supported tool
  configuration before selecting exact files.
- Agree whether focused Playwright E2E coverage is wanted for this
  behavior-bearing change.

## 2. Atomic tasks

1. Identify the existing CR047 retrieval adapter/service and the CR057
   Roleplay integration, then choose the smallest shared or coordinated seam
   that gives both modes one automatic insertion boundary.
2. Define the approved Conversation retrieval target and query from its
   available character and current-turn inputs; preserve CR057's established
   Roleplay target/query behavior.
3. Reuse CR047 filtering, authorization, settings, ranking, threshold,
   embedding, and result-limit behavior without adding caller-specific policy.
4. Implement one transient, delimited untrusted-reference memory block for
   each qualifying generation, preserving existing prompt sources and
   preventing common/mode-specific duplicate insertion.
5. Preserve silent no-op behavior for disabled characters, empty queries or
   corpora, no matches, unavailable/mismatched embeddings, and retrieval
   errors.
6. Verify and, only if necessary, repair the existing
   `search_character_daily_memories` tool registration/execution paths so the
   tool remains available alongside automatic injection and unrelated tools
   remain unchanged.
7. Add focused server/shared regressions for both modes, target/query
   construction, prompt placement, duplicate prevention, gating, isolation,
   failure handling, and tool availability.
8. Add focused Playwright coverage only if agreed, using the CR058 path and
   repository evidence conventions.
9. Run focused regressions and proportionate integrity checks, inspect the
   final diff, and run the primary application build before manual validation
   when work is merged or checked out in the primary nested checkout.
10. Complete independent review, validation, local integration, and tracker
    updates with exact evidence.

## 3. Expected files and surfaces

Exact paths require code inspection during planning. Expected surfaces are:

- Server-side Conversation generation/context assembly and model-request
  boundary.
- Server-side Roleplay generation/context assembly affected by CR057.
- Shared Character Daily Memory retrieval service and contracts, only if a
  narrow adapter/export is required.
- Existing Chat, Character Briefing, Preview, and other supported tool
  registration/runtime surfaces, read or narrowly adjusted only to preserve
  availability.
- Focused server/shared regression scripts and optional CR058 E2E specs.
- No persistence schema, scheduler, client setting, or unrelated tool changes
  are expected.

## 4. Verification

- Verify both modes automatically inject eligible character memories exactly
  once at the approved prompt boundary.
- Verify Conversation and Roleplay use their approved character target and
  query inputs, including multi-character and cross-character isolation.
- Verify disabled settings, empty/no-match data, unavailable or mismatched
  embeddings, and retrieval failures leave generation available.
- Verify the explicit `search_character_daily_memories` tool remains exposed
  and executable in every currently supported caller, and generic Tool Use
  behavior is unchanged.
- Verify existing cards, summaries, session memories, scene/source context,
  trackers, emotions, recent dialogue, and other prompt sources remain intact.
- Run focused regressions, changed-surface typecheck/lint, `git diff --check`,
  and the proportionate repository check/build selected by validation.

## 5. Rollback

Revert the focused CR058 application commit(s) or retire the dedicated
worktree. Preserve CR042/CR047/CR057 persistence, retrieval contracts, tool
definitions, and stored Daily Memories; no data migration or deletion is part
of rollback.

## 6. Approved planning decisions

- Automatic Character Daily Memory context is required in both Conversation
  and Roleplay modes.
- Automatic context is additive, transient, clearly delimited, and inserted
  once per generation using the shared CR047 retrieval policy.
- The existing `search_character_daily_memories` tool remains available for
  explicit model retrieval; automatic injection must not replace or disable
  it.
- Empty, disabled, no-result, and retrieval-error cases are silent no-ops.
- No new client setting, persistence field, schema migration, or unrelated
  tool exposure is planned.
- Exact Conversation query/target inputs and the final prompt boundary are
  confirmed during implementation planning against the current code.

## 7. Handoff

Planning approval is not a separate blocker because the user directly
authorized this clearly scoped implementation. Implementation, independent
review, validation, and local integration remain pending.
