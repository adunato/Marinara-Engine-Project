# CR045 Implementation Plan — Integrate Character Emotion CRs on Staging

## Status

Intake / worktree preparation. This plan records the later implementation
work; it does not create an application worktree or change `staging`.

## Prerequisites

- Confirm the application repository has the intended `staging` commit
  `80f688df25b691ab3dc602c0c33470d32bf6124b` available locally.
- Create the dedicated temporary worktree and branch
  `change/CR045-character-emotions-staging-integration` from that commit in
  the Worktree stage.
- Read the current staging contribution guidance and inspect the source CR035
  and CR041 artifacts before porting.
- Keep the primary application checkout, staging branch, and unrelated user
  work untouched.

## Atomic tasks

1. Create/adopt the isolated CR045 application worktree from `staging`.
2. Compare CR035's implementation to staging and port its existing behavior,
   adapting only moved or renamed integration points.
3. Verify the CR035 port preserves native expression management, configured
   emotion state handling, next-turn conditionals, per-swipe avatar behavior,
   and existing fallback behavior.
4. Compare CR041's implementation to the ported CR035 contracts and port its
   existing per-message generation-emotion persistence and display behavior.
5. Resolve shared types, serialization, generation-route, rendering, editor,
   settings, and policy conflicts as required by the current staging code,
   without changing the source CR behavior.
6. Inspect the focused diff and run proportionate CR035/CR041 regression and
   staging-baseline checks.
7. Commit the completed application branch. Leave it unmerged and unpublished
   while staging testing continues.

## Planned application areas

Exact files must be confirmed in the isolated worktree. Expected areas are:

- current server generation routes and post-generation expression handling;
- shared chat/message types and serialization used by CR035 and CR041;
- current conversation/roleplay message rendering and swipe state;
- current character expression/emotion editor and settings surfaces;
- current staging policy/capability integration points;
- focused regression tests for expression/emotion and generation-label behavior.

Parent records are this CR folder and the corresponding row in
`change_requests/tracker.md`.

## Verification

- Confirm branch ancestry is the stated staging commit.
- Run focused CR035 and CR041 regression checks after the port.
- Run the smallest current-staging baseline check that covers the changed
  server/client/shared surfaces; use the repository's broader check when the
  port is substantive or cross-cutting.
- Inspect `git diff --check` and the final application diff.
- Record any unavailable manual or provider-backed checks without substituting
  unrelated evidence.

No merge into staging, remote push, or publish is part of this plan.

## Rollback

Before merge, discard the isolated CR045 branch/worktree or revert its focused
application commit. Do not reset, rewrite, or modify `staging`; leave the
completed CR035 and CR041 source records unchanged.
