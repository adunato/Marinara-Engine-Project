# CR025 — Implementation Plan

## Prerequisites

- [x] Base the branch on local application `main` containing CR024 (`7e6743925`).
- [x] Preserve CR022's corpus-wide map and CR023's correction pattern.

## Implementation

- [x] Replace the all-pages materialization operation with a target-page operation.
- [x] Start one fresh sequential runtime session for each page in the frozen map.
- [x] Provide the target assignment and full map context to each page session.
- [x] Restrict page sessions to their target wiki path and remove index-writing capability.
- [x] Preserve mapped cross-links before their destination files exist.
- [x] Validate required reads, assigned citations, target writes, and structured completion.
- [x] Continue an incomplete page candidate within the same session with exact corrective feedback.
- [x] Finalize `index.md` deterministically after all pages succeed.
- [x] Add `build-page` operation logging and retain the final `build` revision ledger.
- [x] Update Character Mind documentation and embedded schema guidance.

## Files Affected

- `packages/server/src/services/character-mind/character-mind.constants.ts`
- `packages/server/src/services/character-mind/character-mind.runtime.ts`
- `packages/server/src/services/character-mind/character-mind.service.ts`
- `packages/server/src/services/character-mind/character-mind.tools.ts`
- `packages/server/src/services/character-mind/character-mind.log.ts`
- `scripts/regressions/character-mind.regression.ts`
- `docs/conversation/character-minds.md`

## Verification

- [x] `pnpm regression:character-mind`
- [x] `pnpm --filter @marinara-engine/server lint`
- [x] `pnpm build` in the primary application checkout after integration

## Rollback

Revert application commit `20fbdd4f6`. This restores the single all-pages materialization session without changing raw Character Mind source snapshots.

