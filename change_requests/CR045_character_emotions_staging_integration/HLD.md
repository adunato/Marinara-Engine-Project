# CR045 — Integrate Character Emotion CRs on Staging

## Status

Intake / worktree preparation. No application implementation or staging
integration has started.

## Goal

Prepare a dedicated application branch from the current `staging` baseline to
port the completed CR035 Character Emotion States and Expression Integration
and CR041 Per-Message Generation Emotion Labels changes onto the current
staging code base.

The port must preserve the approved and tested behaviour of both CRs. This is
a compatibility integration request, not a redesign of the native expression
system or either feature.

## Base and branch intent

- Application base: `staging` at
  `80f688df25b691ab3dc602c0c33470d32bf6124b`.
- Planned application branch: `change/CR045-character-emotions-staging-integration`.
- Use a dedicated temporary application worktree for implementation in the
  later Worktree stage.
- Do not merge into `staging`, push, publish, or alter the staging checkout
  while parallel staging testing is in progress.

## Dependencies

- CR035 — Character Emotion States and Expression Integration.
- CR041 — Per-Message Generation Emotion Labels (depends on CR035).

## Proposed solution

1. Establish the dedicated CR045 branch from the stated staging commit.
2. Port CR035 first, reconnecting its existing behavior to staging's current
   generation, native expression, persistence, policy, and UI/type seams where
   those seams have moved or changed.
3. Port CR041 second, preserving its existing per-message generation-label
   persistence and display behavior on top of the ported CR035 contracts.
4. Resolve only codebase-drift and integration conflicts revealed by staging;
   do not introduce new emotion precedence, fallback, schema, or UI behavior.
5. Validate the combined branch before any later ship or merge decision.

The staging native expression behavior remains the compatibility baseline.
Existing `expressionAvatarsEnabled` / `spriteExpressions` behavior and the
completed CR035/CR041 contracts must continue to operate as defined by their
source CRs.

## Risks

- Staging has moved the policy, generation, shared-type, and UI integration
  points used by the original CR commits; an incomplete port could compile but
  omit a runtime path.
- CR041 relies on CR035's runtime and message contracts, so integrating it out
  of order could create inconsistent labels or persistence.
- Parallel testing on staging means the integration branch must remain
  isolated and must not modify or consume uncommitted staging work.

## Validation

Validation is deferred to the later Validation stage and must be run against
the CR045 branch. At minimum, compare the port against the source CR behavior
and exercise native expression selection, CR035 emotion persistence and
mapping, per-swipe avatars, CR041 labels, regeneration, and multi-character
messages. Run the proportionate staging checks after the port; do not merge
or push as part of this intake.

## Completion criteria

The integration is ready for review when CR035 and CR041 are ported in order
onto the stated staging base, their existing behavior is preserved, focused
and baseline validation passes, and the branch remains separate from staging.
