# CR057 Implementation Plan - Character Daily Memory Retrieval in Roleplay

_Status: Draft; planning required._

## 1. Prerequisites

- Obtain planning approval for the unresolved Roleplay integration boundary:
  host-managed prompt context, an internal bounded memory-only tool loop, or a
  deliberate opt-in combination.
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

1. Map the normal Roleplay generation path and document the exact seam where
   current character IDs, recent messages, and configured memory settings are
   available.
2. Compare the available host-managed and internal-tool-loop options for
   latency, prompt size, provider compatibility, tool exposure, failure
   handling, and multi-character correctness; record the approved choice.
3. Reuse the CR047 retrieval service and policy without adding caller-specific
   ranking, threshold, embedding, or corpus behavior.
4. Implement the selected Roleplay query construction and retrieval trigger,
   including the approved feature default/flag and single- or
   multi-character target policy.
5. Add the selected prompt block or memory-tool contract with explicit
   delimiters/attribution, stable ordering, duplicate suppression, and no
   unrelated tool registration.
6. Preserve safe degradation for disabled settings, empty queries/results,
   unavailable or mismatched embeddings, retrieval failures, and provider/tool
   errors; ordinary Roleplay response generation must remain available.
7. Add focused server/shared/client regressions for enabled and disabled
   retrieval, query construction, target scope, prompt/tool placement, and
   preservation of existing Roleplay context sources.
8. Add focused Playwright coverage only if agreed, using the CR057 path and
   the repository's existing evidence conventions.
9. Run the focused regression and proportionate integrity checks, inspect the
   final diff, and run the primary application build before manual validation
   when the work is merged or checked out in the primary nested checkout.
10. Complete independent review, validation, and local integration stages;
    update this plan and the tracker with the resulting evidence.

## 3. Expected files and surfaces

Exact paths require code inspection during planning. Expected surfaces are:

- Roleplay generation/context assembly and its model-request boundary.
- Existing Character Daily Memory retrieval service and shared retrieval
  contracts, only if a narrow adapter/export is needed.
- Existing Roleplay tool-resolution/runtime code, only if the approved design
  uses a memory-only internal tool loop.
- Existing per-character settings/API/client UI surfaces, only if planning
  approves a new explicit Roleplay control or feature flag.
- Focused server/shared/client regression scripts and optional CR057 E2E
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
- Verify the approved multi-character policy: each supported target is
  independently scoped and labelled once, or unsupported targets are excluded
  deterministically.
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

## 6. Open planning decisions

- Should retrieval be host-managed and automatically injected, or should a
  memory-only internal tool loop be used?
- If host-managed, which Roleplay messages form the query and where exactly is
  the delimited memory block placed?
- If tool-based, how is the loop bounded and isolated from unrelated tools,
  and how are provider/tool errors handled?
- Does the feature apply to the single responding character only, or to all
  eligible characters in a multi-character Roleplay? What ordering and
  attribution are required?
- Is an explicit per-character/session Roleplay enablement control required,
  or does existing Daily Memory enablement govern it by default? What should
  older characters do when the new setting is absent?
- Is a prompt-size/result-count guard needed in addition to CR047's persisted
  minimum-rank policy, and if so where is that guard owned and documented?
- Is focused Playwright E2E coverage required for acceptance?

## 7. Handoff

Implementation, independent review, validation, and local integration remain
pending planning approval and resolution of the open decisions above.
