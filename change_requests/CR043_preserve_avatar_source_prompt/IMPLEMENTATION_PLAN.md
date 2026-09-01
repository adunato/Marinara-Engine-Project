# CR043 Implementation Plan — Preserve Avatar Source Prompt for Normal Character Generation

## Status

Implemented and validated in application commit `5e5a4ac74a9db90d3e9ad740fbc972b03613c1c1` on `change/CR043-preserve-avatar-source-prompt`.

## Prerequisites

- Implement only in the dedicated nested app worktree on `change/CR043-preserve-avatar-source-prompt`.
- Preserve unrelated work and leave reference-image and non-Character generation paths unchanged.

## Atomic Tasks

1. Locate the normal Character avatar-generation prompt handoff. **Complete.**
2. Make the minimal change that preserves the original source prompt. **Complete.**
3. Inspect the focused diff and run proportionate focused checks. **Complete.**

## Files and Verification

- Application source: `packages/server/src/routes/characters.routes.ts` and `packages/shared/src/utils/image-prompt-compiler.ts`.
- Regression coverage: `scripts/regressions/prompt.regression.ts`.
- Parent records: this CR folder and `change_requests/tracker.md`.
- Validation: `git diff --check`, `pnpm regression:prompt`, and `pnpm check` passed; no ComfyUI/provider E2E or manual UI test was performed.

## Rollback

Revert the focused application commit; no schema, persistence, dependency, or release changes are expected.
