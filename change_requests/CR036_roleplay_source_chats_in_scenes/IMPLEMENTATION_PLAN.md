# CR036 Implementation Plan

## Implementation Status

Implemented on `change/CR036-roleplay-source-chats-in-scenes` and merged into local application `main`.

## Prerequisites

- Start from nested application `main` at the CR036 base commit.
- Use a dedicated temporary nested application worktree.

## Tasks

1. Change only the Roleplay Source Chats route gate so it applies to active Scenes as well as ordinary Roleplays.
2. Leave connected Conversation/OOC/influence Scene exclusion behavior untouched.
3. Add a static regression assertion for the route condition and its absence of `!isSceneChat`.
4. Document Scene Source Chats and the separate connected Conversation exclusion.
5. Add an Unreleased changelog fix entry.
6. Run the focused regression and `pnpm check` once each.
7. Commit the application branch, merge it into nested local `main`, update the parent tracker, commit CR docs/tracker, and remove the temporary worktree.

## Files Affected

- `packages/server/src/routes/generate.routes.ts`
- `scripts/regressions/context-sources.regression.ts`
- `docs/roleplay/scenes.md`
- `CHANGELOG.md`
- Parent `change_requests/CR036_roleplay_source_chats_in_scenes/`
- Parent `change_requests/tracker.md`

## Rollback

Revert the CR036 application commit. The static regression and documentation/changelog edits can be reverted with the parent CR bookkeeping commit if needed.

