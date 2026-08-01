# CR029 Implementation Plan

## Prerequisites

- CR022 corpus map and materialization flow.
- CR025 isolated page sessions.
- CR026 streamed page materialization.

## Tasks

1. Define a constrained Markdown representation for the complete frozen build plan in `index.md`, with deterministic render and parse helpers.
2. Preserve synthesis on ordinary Build retries and reuse the map only when it exactly matches current raw sources.
3. Derive durable completed-page checkpoints from the build log and existing wiki files; skip them during resume.
4. Add an explicit restart flag to the Build API, client hook, and minimal Character Mind controls.
5. Preload `SCHEMA.md` and `index.md` into every Character Mind agent session.
6. Replace the whole-session five-minute signal with a fresh five-minute signal for each provider request.
7. Extend focused regressions and run proportional validation.
8. Commit, fast-forward local application `main`, build the primary checkout, finalize CR records, and remove the temporary worktree.

## Expected Files

- `packages/server/src/services/character-mind/character-mind.constants.ts`
- `packages/server/src/services/character-mind/character-mind.files.ts`
- `packages/server/src/services/character-mind/character-mind.log.ts`
- `packages/server/src/services/character-mind/character-mind.plan.ts`
- `packages/server/src/services/character-mind/character-mind.runtime.ts`
- `packages/server/src/services/character-mind/character-mind.service.ts`
- `packages/server/src/routes/character-minds.routes.ts`
- `packages/client/src/hooks/use-character-minds.ts`
- `packages/client/src/components/chat/CharacterMindModal.tsx`
- `scripts/regressions/character-mind.regression.ts`

## Rollback

Revert the CR029 application commit. Existing raw sources and Markdown pages remain on disk, but incomplete Build retries will again reset synthesis and remap from the corpus.

## Completion

- Application commit: `d04fd930f`
- Local application `main`: fast-forwarded to `d04fd930f`
- Status: implemented, validated, and locally merged
