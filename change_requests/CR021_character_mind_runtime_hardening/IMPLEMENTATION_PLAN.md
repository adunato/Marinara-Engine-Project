# CR021 — Implementation Plan

Status: complete

## Prerequisites

- CR019 Compiled Character Mind and CR020 Character Mind Controls are present on local application `main`.
- Diagnose the failed run from its Phoenix trace rather than inferring from `log.md` alone.

## Tasks

1. Add literal result contracts and exact ingest write-tool guidance to Character Mind prompts and the generated schema.
2. Make unavailable-tool errors enumerate the exact permitted functions.
3. Track unresolved wiki and index mutation failures and surface them before accepting a terminal response.
4. Add focused regression assertions for the prompt and invented-tool failure path.
5. Run the Character Mind regression, server TypeScript validation, and primary-checkout production build.
6. Commit on `change/CR021-character-mind-runtime-hardening`, fast-forward local application `main`, and remove the temporary worktree.

## Files

- `packages/server/src/services/character-mind/character-mind.constants.ts`
- `packages/server/src/services/character-mind/character-mind.tools.ts`
- `packages/server/src/services/character-mind/character-mind.runtime.ts`
- `scripts/regressions/character-mind.regression.ts`

## Rollback

Revert application commit `447c0cb8a`. Character Mind data and database schemas are unchanged.

