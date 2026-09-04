# CR048 Implementation Plan - Capability Runtime Symlink Safety

_Status: Planning._

## 1. Prerequisites

- Confirm local `staging` is the application base and create the dedicated
  worktree/branch `change/CR048-capability-runtime-symlink-safety`.
- Preserve the primary staging checkout and its existing data backups.
- Read the applicable server contribution guidance before editing server code.
- Keep implementation changes limited to launcher protection, capability
  runtime link resolution, and focused regressions.

## 2. Atomic tasks

1. Inspect the existing launcher snapshot copy/filter and identify all
   capability runtime dependency-link locations, including links under
   `capability-runtime-snapshots`.
2. Introduce a link-aware, path-bounded snapshot exclusion that does not
   dereference valid or dangling runtime links and preserves ordinary data.
3. Add launcher regression fixtures covering valid links, dangling links,
   nested package runtime snapshots, and ordinary data preservation.
4. Update `CapabilityModuleRuntime.ensureModuleResolution()` to use
   link-aware existence checks. Reuse a valid link, repair a dangling/stale
   link at the exact runtime path, and leave regular conflicting entries
   untouched with the existing safe diagnostic.
5. Add runtime regressions for absent, valid, dangling, and conflicting
   `node_modules` entries, asserting that the host server dependency path is
   never modified.
6. Run focused launcher/runtime regressions, the staging production build, and
   `git diff --check`; inspect the final diff for scope and generated artifacts.

## 3. Expected files and surfaces

- `scripts/protect-launcher-data.mjs`: link-aware update snapshot filtering.
- `scripts/regressions/launcher-update.regression.mjs`: snapshot protection
  regressions.
- `packages/server/src/services/capability-packages/capability-module-runtime.service.ts`:
  safe capability dependency-link inspection and repair.
- Focused server/runtime regression surface adjacent to the capability module
  runtime, or a new narrow regression script if that is the repository's
  established pattern.
- No client, shared contract, database schema, or persisted user-data format
  changes are planned.

## 4. Verification

- Confirm the worktree branch is based on the intended local staging commit.
- Exercise launcher snapshot creation with both live and dangling capability
  runtime links; verify the backup excludes those links and retains ordinary
  files.
- Exercise capability runtime startup with no link, a valid link, a dangling
  link, and a regular conflicting entry; verify no `EEXIST` occurs for the
  dangling case and no host dependency directory is changed.
- Run the focused regressions once, then run the staging production build.
- Run `git diff --check` and review changed-file scope.

## 5. Rollback

Before integration, revert the focused CR048 application commit or retire its
dedicated worktree. Do not reset or overwrite the primary staging checkout.

## 6. Handoff

Implementation, review, validation, and local staging integration remain to be
completed on the dedicated CR048 application branch.
