# CR056 Implementation Plan - Character Briefing Roleplay Injection

_Status: Planning._

## 1. Prerequisites

- Confirm local application `main` contains the completed CR044 Character
  Briefing implementation and use it as the application base.
- Create the dedicated nested application worktree and branch
  `change/CR056-roleplay-character-briefing`.
- Read the applicable application contribution guidance and inspect the
  existing Roleplay and Conversation context assembly before selecting exact
  files.
- Preserve CR044's Conversation injection contract and keep the implementation
  limited to Roleplay context integration plus focused regressions.

## 2. Atomic tasks

1. Trace Roleplay target resolution, context assembly, and final model-request
   construction; identify the correct prompt boundary and ordering for
   additive Character Briefing context.
2. Reuse or extend the existing Character Briefing formatter/access helper so
   Roleplay receives only applicable non-empty Latest Briefings with stable
   character attribution and no duplicate IDs.
3. Integrate the briefing at the selected Roleplay generation seam without
   changing existing Roleplay source-chat, card, memory, tracker, or other
   configured context behaviour.
4. Add focused regressions for one target, empty/missing briefing, multiple
   targets, duplicate IDs, and non-target exclusion as supported by the
   current Roleplay pipeline.
5. Run the focused regression and proportionate repository checks, inspect the
   final diff, and build the primary checkout when required for manual
   validation.

## 3. Expected files and surfaces

Exact paths require code inspection during planning. Expected surfaces are:

- Existing Character Briefing context formatter/access helper, if shared
  changes are required for Roleplay use.
- Roleplay generation context/prompt assembly and its focused regression
  surface.
- Existing Conversation Character Briefing regression surface only if a small
  shared-contract assertion is needed.
- No new database schema, persistence, provider configuration, or client UI
  files are expected.

## 4. Verification

- Verify the branch starts from the intended local `main` CR044-integrated
  commit.
- Exercise a Roleplay request with one non-empty Latest Briefing and confirm
  the exact attributed context block is present at the chosen seam.
- Exercise empty/missing briefing and multi-target cases; confirm no duplicate
  blocks and no non-target leakage.
- Confirm Conversation prompt behaviour remains unchanged through the existing
  CR044 regression or equivalent focused check.
- Run `git diff --check` and the narrowest relevant typecheck/lint/test checks;
  run the primary application build before manual validation when the work is
  merged or checked out in the primary nested checkout.

## 5. Rollback

Revert the focused CR056 application commit or retire its dedicated worktree.
No data migration is expected, and CR044's persisted briefing data and
Conversation integration must remain intact.

## 6. Handoff

Implementation, independent review, validation, and local integration remain
to be completed on the dedicated CR056 application branch after planning
approval.
