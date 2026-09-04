# CR048 - Capability Runtime Symlink Safety

_Status: Planning._

## 1. Purpose

Make launcher data protection and capability runtime startup safe around
runtime dependency links on Windows. A launch from the staging checkout must
not fail while snapshotting capability runtime links, and a stale or dangling
runtime link must not cause startup to abort with `EEXIST`.

## 2. Goals

- Keep capability runtime dependency links out of launcher update snapshots and
  backups, including links nested under per-package runtime snapshots.
- Handle valid, dangling, and stale capability `node_modules` links without
  following or copying them.
- Let the capability runtime reuse a valid dependency link and repair only an
  invalid link at the exact capability runtime location.
- Preserve ordinary pnpm-managed `packages/server/node_modules` contents and
  all user-owned data.
- Keep auto-update fail-safe: a protected-data snapshot should complete when
  runtime-only links are present, while genuine snapshot errors still skip the
  update.

## 3. Non-goals

- Do not remove the live capability runtime dependency-link mechanism; it is
  required for package module resolution on the installed application.
- Do not copy runtime dependency directories into user-data backups.
- Do not change capability package manifests, package installation policy,
  storage schema, or memory behavior.
- Do not clean arbitrary symlinks, junctions, worktrees, or `node_modules`
  entries outside the exact capability runtime surfaces.

## 4. Base and branch intent

- Application base: local `staging` at the CR047-integrated head.
- Planned application branch: `change/CR048-capability-runtime-symlink-safety`.
- Parent CR documentation remains in this repository; implementation must use a
  dedicated nested application worktree.

## 5. Proposed solution

### Launcher protection

Harden `scripts/protect-launcher-data.mjs` so its snapshot copy filter treats
capability runtime dependency links as excluded runtime infrastructure rather
than user data. The exclusion must cover the live
`data/capability-packages/node_modules` entry and each generated
`node_modules` entry beneath `data/capability-runtime-snapshots`, regardless of
whether the link target currently exists. The filter must not dereference a
link while deciding whether to copy it and must continue to preserve all other
data and recovery semantics.

Add focused launcher regressions for valid and dangling junction/symlink
entries, nested runtime snapshots, and a normal data directory that still
gets copied.

### Capability runtime startup

Harden `CapabilityModuleRuntime.ensureModuleResolution()` to distinguish an
absent path from an existing filesystem entry whose target is unavailable.
When the exact capability runtime `node_modules` entry is a valid link to the
current server dependencies, leave it alone. When it is a stale or dangling
link, remove only that link and recreate the expected current link. When a
non-link entry occupies the path, do not replace it silently; retain the
existing safe warning/error behavior and avoid touching
`packages/server/node_modules`.

Use link-aware filesystem inspection so the repair works on Windows junctions
whose targets refer to a removed temporary worktree. Keep cleanup bounded to
the capability runtime path and ensure a failed recreation does not delete
unrelated data.

Add focused runtime regressions for absent, valid, dangling, and conflicting
entries, including the invariant that the host server dependency directory is
never replaced.

## 6. Invariants and boundaries

- Update snapshots never contain capability runtime dependency links or their
  dereferenced contents.
- A dangling capability runtime link cannot make snapshot creation fail with
  `EPERM` and cannot make runtime startup fail with `EEXIST`.
- Only the exact live capability runtime link may be repaired; no broad
  recursive deletion is permitted.
- Existing non-runtime data remains in snapshots and can still be restored.
- Valid runtime links remain usable and are not needlessly recreated.
- The application continues to use the current server dependency directory;
  its pnpm-managed `node_modules` entry is not modified by this change.

## 7. Risks and mitigations

- **Link inspection may dereference a removed target.** Use `lstat`/directory
  entry metadata and test dangling links explicitly.
- **Snapshot filtering may be too broad.** Match only the documented
  capability package and capability runtime snapshot roots, and add a
  preservation fixture for unrelated data.
- **A failed repair could remove a usable path.** Confirm the entry is a
  symlink/junction and its target is invalid before unlinking; never remove a
  regular directory or file automatically.
- **Platform differences may hide Windows behavior.** Keep the production
  logic platform-neutral where possible and include Windows-aware regression
  coverage or deterministic filesystem mocks for junction semantics.

## 8. Validation expectations

- Focused launcher snapshot regressions pass for valid and dangling runtime
  links, including nested runtime snapshot links, with no `EPERM`.
- Focused capability runtime regressions pass for first creation, valid-link
  reuse, dangling-link repair, and conflicting regular-entry handling.
- The staging server/client production build passes.
- `git diff --check` passes and the application diff contains no unrelated
  generated data or worktree artifacts.
- No database migration, release check, or E2E specification is expected.

## 9. Rollback

Revert the focused CR048 application commit. No user data, capability package
records, or schema files are modified by the implementation.
