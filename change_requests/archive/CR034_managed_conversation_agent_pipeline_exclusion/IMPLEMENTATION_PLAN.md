# CR034 Implementation Plan

## Prerequisites

- Confirm the traced process and build state that allowed managed agents into the generic batch.

## Tasks

1. Trace generic agent resolution from persisted configuration to the batch executor.
2. Correct the runtime exclusion at the source of resolved pipeline agents.
3. Add a focused regression test proving `daily-memory` and `daily-intentions` are excluded while ordinary agents remain eligible.
4. Build the application and inspect the generated server output.
5. Restart only when necessary for manual verification, then confirm the next Phoenix trace.

## Files expected

- `packages/server/src/services/generation/agent-resolution.ts`
- focused server test files, if existing coverage conventions support it

## Verification

- Focused regression test
- `pnpm check`
- `pnpm build`

## Rollback

Revert the CR034 commit; native managed-agent behavior remains unchanged.
