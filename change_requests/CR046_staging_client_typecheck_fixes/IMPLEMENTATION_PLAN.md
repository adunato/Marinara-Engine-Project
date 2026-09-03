# CR046 Implementation Plan — Staging Client TypeScript Build Fixes

## Status

Intake. This plan scopes the later application work and does not create an
application worktree or modify the nested `staging` checkout.

## Prerequisites

- Confirm local `staging` resolves to `cac782f1b06539c2c354f864ed0acc4bfd410b7c`.
- Create the dedicated temporary worktree and branch
  `change/CR046-staging-client-typecheck-fixes` from `staging` during the
  Worktree stage.
- Read the client instructions before editing client files.
- Preserve all unrelated worktree changes and keep the primary application
  checkout untouched.

## Atomic tasks

1. Create/adopt the isolated CR046 worktree from the staging base.
2. Inspect `ChatModeIcon` and its call sites; repair the shared icon prop
   contract so valid Lucide props such as `className` remain supported.
3. Type the unannotated callback parameters in `EncounterModal` using the
   actual event target/control contract.
4. Type the unannotated element and event callback parameters in
   `QuickReplyMenu` using the actual DOM APIs those callbacks consume.
5. Type the unannotated event callback parameters in `ChatSidebar` and
   `ConnectionsPanel` without changing their event handling behavior.
6. Run the focused client build and inspect the diagnostics; run `pnpm check`
   when the focused build is clean or when required to validate cross-package
   effects.
7. Run `git diff --check`, review the final diff for scope, and commit the
   application changes on the CR branch.

## Planned application areas

- `packages/client/src/components/chat/ChatSettingsDrawer.tsx`
- `packages/client/src/components/chat/HomeBrowserHub.tsx`
- `packages/client/src/components/chat/RecentChats.tsx`
- `packages/client/src/components/chat/EncounterModal.tsx`
- `packages/client/src/components/chat/QuickReplyMenu.tsx`
- `packages/client/src/components/layout/ChatSidebar.tsx`
- `packages/client/src/components/panels/ConnectionsPanel.tsx`
- the client definition of `ChatModeIcon` and its shared prop type, wherever
  confirmed in the isolated staging worktree

## Verification

- Confirm the CR branch is based on the intended staging commit.
- Run the client build (`pnpm --filter @marinara-engine/client build`) and
  confirm it exits successfully with no listed TypeScript diagnostics.
- Run `pnpm check` as the proportional cross-cutting baseline if available.
- Run `git diff --check` and inspect changed-file scope.
- Record any repository-wide unrelated baseline failure separately rather than
  weakening the TypeScript configuration.

## Rollback

Before integration, remove the isolated CR046 worktree/branch or revert its
focused application commit. Do not reset, rewrite, or modify `staging`; the
source commits and CR044 implementation remain unchanged.
