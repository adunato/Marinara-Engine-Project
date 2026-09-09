# CR057 Implementation Plan - Character Daily Memory Retrieval in Roleplay

_Status: Approved; implementation pending._

## 1. Prerequisites

- Use the approved host-managed, pre-generation prompt-context integration;
  no internal tool loop or Roleplay-specific client opt-in is required.
- Confirm local application `main` contains the CR042 character-owned Daily
  Memory implementation and CR047's shared retrieval policy.
- Create the dedicated nested application worktree and branch
  `change/CR057-character-daily-memory-roleplay` from local `main`.
- Read the application contribution guidance and, before any client edit, the
  client instruction file.
- Trace current Roleplay target resolution, current-turn transcript/query
  inputs, final prompt assembly, tool configuration, and provider request
  boundaries before fixing exact files.
- Agree whether focused Playwright E2E coverage is wanted for this
  behavior-bearing change.

## 2. Atomic tasks

1. Map the normal Roleplay generation path and identify the exact server-side
   seam where the single prompted character, latest user message, and prompt
   context are available.
2. Reuse the CR047 retrieval service and policy without adding caller-specific
   ranking, threshold, embedding, or corpus behavior.
3. Implement the gated Roleplay retrieval trigger: exactly one prompted
   character, enabled Daily Memories, and a non-empty latest user message;
   use that latest user message as the query.
4. Add the transient, clearly delimited untrusted-reference memory block at
   the selected prompt boundary, preserving all existing Roleplay context and
   emitting it at most once.
5. Preserve safe degradation for disabled settings, empty queries/results,
   unavailable or mismatched embeddings, retrieval failures, and provider/tool
   errors; ordinary Roleplay response generation must remain available.
6. Add focused server/shared regressions for enabled and disabled retrieval,
   latest-message query construction, single-/multi-character target scope,
   prompt placement, failure isolation, and preservation of existing Roleplay
   context sources. Add no client setting unless a later approved design
   change expands scope.
7. Add focused Playwright coverage only if agreed, using the CR057 path and
   the repository's existing evidence conventions.
8. Run the focused regression and proportionate integrity checks, inspect the
   final diff, and run the primary application build before manual validation
   when the work is merged or checked out in the primary nested checkout.
9. Complete independent review, validation, and local integration stages;
   update this plan and the tracker with the resulting evidence.

## 3. Expected files and surfaces

Exact paths require code inspection during planning. Expected surfaces are:

- The server-side Roleplay generation/context assembly and model-request
  boundary (exact paths to be confirmed by task 1).
- Existing Character Daily Memory retrieval service and shared retrieval
  contracts, only if a narrow adapter/export is needed.
- Existing Roleplay tool-resolution/runtime code is out of scope unless needed
  to verify generic Tool Use remains unchanged; no internal memory-only loop is
  planned.
- Existing per-character Daily Memory setting/API surfaces are read-only inputs;
  no client setting or schema migration is planned.
- Focused server/shared regression scripts and optional CR057 E2E
  specs.
- No new persistence schema, Daily Memory formation scheduler, or unrelated
  tool definitions are expected.

## 4. Verification

- Verify the implementation starts from local `main` with CR042/CR047
  behavior intact and no unrelated application changes.
- With generic Roleplay Tool Use disabled, verify an enabled character's
  eligible Daily Memories are retrieved through the approved host/tool seam
  and made available exactly as designed.
- Verify disabled characters, absent/invalid settings, empty queries/corpora,
  no qualifying memories, unavailable/mismatched embeddings, and retrieval
  failures do not block the Roleplay response.
- Verify the approved multi-character policy: retrieval is skipped
  deterministically, with no cross-character leakage or duplicate memory
  block.
- Verify unrelated tools are neither exposed nor invoked as a side effect and
  existing user-configured tool behavior is preserved.
- Verify prompt ordering/delimiters and preservation of cards, summaries,
  session memories, scenes/source chats, trackers, emotions, and recent
  dialogue.
- Verify Conversation, Chat custom-tool, Preview, and Character Briefing
  retrieval behavior remains on the CR047 shared policy.
- Run focused regressions, changed-surface typecheck/lint, `git diff --check`,
  and the proportionate repository check/build selected by validation.

## 5. Rollback

Revert the focused CR057 application commit(s) or retire the dedicated
worktree. Remove any new Roleplay-only flag/default only if it was introduced
by the approved design; preserve CR042/CR047 persistence and retrieval data,
contracts, and non-Roleplay behavior. Do not perform a data migration or
delete existing Daily Memories as part of rollback.

## 6. Approved planning decisions

- Retrieval is host-managed and runs once before the normal Roleplay model
  request; generic Tool Use remains independent and unchanged.
- The latest non-empty user message is the query. The implementation will
  place results at a clearly delimited, untrusted-reference prompt boundary
  while preserving existing Roleplay context ordering.
- Only Roleplay sessions with exactly one prompted character are eligible.
  Multi-character sessions are skipped to avoid ambiguous attribution.
- Existing per-character Daily Memory enablement governs retrieval. No new
  client setting, feature flag, persistence field, or migration is planned.
- CR047 owns filtering, authorization, ranking, thresholds, embeddings, and
  limits. No additional caller-specific result cap is approved.
- Empty/no-match/error paths are silent no-ops with response generation
  preserved. Focused Playwright E2E coverage is optional and must be agreed
  during validation.

## 7. Handoff

Planning is approved. Implementation, independent review, validation, and
local integration remain pending.
