# CR049 Implementation Plan - Character Session Memories Management

_Status: Planning; awaiting implementation._

## 1. Prerequisites

- Confirm local application `main` is the intended base and create the
  dedicated worktree/branch `change/CR049-session-memories-management`.
- Read the application contribution guidance and the client instructions
  before editing frontend code.
- Inspect the existing Character Editor tab registry, character update client
  helper, character-card extension merge behavior, and scene-conclusion
  persistence path.
- Preserve the primary nested checkout and all unrelated parent-repository
  changes.

## 2. Atomic tasks

1. Define the session-memory view/update contract, including the optional
   `characterMemoriesEnabled` setting, default-enabled semantics, defensive
   handling of malformed entries, and preservation of unknown extensions.
2. Add a dedicated `Session Memories` Character Editor tab and wire it into the
   editor independently of the daily `Memories` tab.
3. Implement safe rendering for populated, empty, and malformed
   `characterMemories` arrays, showing source/date metadata when available.
4. Add per-entry summary editing and deletion, with loading/error handling and
   server-backed refresh after each mutation.
5. Add clear-all with explicit confirmation and ensure it changes only the
   `characterMemories` array.
6. Add the per-character saving toggle, persisting the setting while treating
   an absent value as enabled.
7. Gate the existing scene-conclusion session-summary persistence operation on
   the setting. With the setting disabled, leave scene completion, historical
   entries, retrieval, daily memories, and unrelated extensions unchanged.
8. Add focused regressions for extension merge preservation, malformed legacy
   entries, CRUD/clear behavior, setting defaults, and enabled/disabled scene
   persistence.
9. Run focused checks, the appropriate app integrity check and production
   build, then inspect the final diff for unrelated files or generated data.

## 3. Expected files and surfaces

- Character Editor tab registry/container under
  `packages/client/src/components/characters/`.
- New session-memory tab component under the same client character-editor
  surface.
- Existing client character API/update hook or a narrow session-memory client
  helper, depending on the repository's established request pattern.
- `packages/server/src/routes/scene.routes.ts`: setting-aware session-summary
  persistence gate.
- Existing character route/storage service, or a focused adjacent helper, for
  atomic session-memory and setting mutations that preserve other extensions.
- Shared character type definitions only if the optional setting or entry
  contract is made explicit there.
- Focused client/server regression files adjacent to the existing character
  memories and scene routes; CR-specific Playwright coverage, if agreed,
  belongs under `tests/e2e/specs/change-requests/CR049/`.
- No database schema, release metadata, or unrelated memory-system files are
  planned.

## 4. Verification

- Verify the dedicated worktree is based on local application `main`.
- Exercise the new tab with no entries, valid entries, and malformed legacy
  values; verify the daily `Memories` tab remains independent.
- Edit and delete one entry, clear all entries, and toggle saving; verify
  errors are surfaced and unrelated extension keys survive each write.
- Conclude a scene with the setting absent/enabled and disabled; verify only
  the new session-summary persistence is gated and historical entries remain.
- Run focused regressions once, then the proportionate client/server check and
  production build.
- Run `git diff --check` and review changed-file scope before commit.
- If focused Playwright E2E is agreed, capture the tab CRUD, clear confirmation,
  and toggle behavior with the repository's CR naming and evidence conventions.

## 5. Rollback

Before integration, revert the focused CR049 application commit or retire its
dedicated worktree. Do not reset or overwrite the primary nested checkout.
Existing character-card session-memory data is not automatically removed by
rollback.

## 6. Handoff

Implementation, independent review, validation, and local-main integration
remain to be completed on the dedicated CR049 application branch. After the
behavior-bearing implementation is complete, confirm with the user whether
focused Playwright E2E validation should be added.
