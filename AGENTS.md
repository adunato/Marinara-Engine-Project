# AGENTS.md

This file is a thin maintainer note for contributors using Codex. The application repository lives in `Marinara-Engine/`; canonical app workflow, validation, and release guidance lives in `Marinara-Engine/CONTRIBUTING.md`.

## Preferred Workflow

- Run app development commands from `Marinara-Engine/`.
- Run `cd Marinara-Engine && pnpm install` only when dependencies are missing or dependency manifests/lockfiles changed. Do not reinstall dependencies as routine validation.
- Run `cd Marinara-Engine && pnpm check` as the baseline validation for substantive or cross-cutting app changes, not automatically for every trivial edit.
- Keep validation proportional. Use the smallest check that can catch a plausible failure, run it once, and stop. Do not repeat broad checks after a timeout or stack lint, typecheck, build, and E2E when they provide redundant evidence.
- After application changes are merged or checked out in the primary `Marinara-Engine/` folder for manual validation, run `cd Marinara-Engine && pnpm build` there before starting the app. Build artifacts created in a temporary worktree do not carry into the primary checkout.
- Never leave a server instance started by Codex running after the task or validation turn. Stop its launcher and child processes, then verify its port is no longer listening before handing work back to the user.
- Run local tool commands, including Playwright E2E harness commands, from this parent repo.
- After a behavior-bearing change request is complete, agree with the user whether to generate focused Playwright E2E validation. Skip this discussion for trivial visual/constants-only changes unless the user requests E2E.
- Run `pnpm db:push` when server or database changes need schema verification.
- Run `pnpm version:check` when you touch release metadata, version-bearing files, or README release references.

## Repo-Specific Cautions

- Keep edits non-destructive. Do not revert unrelated work in the tree.
- Make every application repository change from a dedicated temporary `git worktree` checked out to the target branch inside `Marinara-Engine/`. Treat the primary nested checkout as coordination context only.
- Commit every completed change before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
- Remove the temporary worktree after the successful commit and validation, unless the user explicitly asks to keep it.
- Do not create folders or files outside `Marinara-Engine-Project/` except for temporary sibling `git worktree` checkouts needed for this workflow. If a task appears to require any other external checkout, cache, or generated artifact, stop and ask the user first.
- Prefer focused patches that keep code, docs, and release metadata aligned in the same change.
- When preparing a PR, make the why explicit in the description so reviewers can see the user problem or rationale, not just the file changes.
- Check `Marinara-Engine/README.md`, `Marinara-Engine/android/README.md`, `Marinara-Engine/CONTRIBUTING.md`, `Marinara-Engine/CHANGELOG.md`, `Marinara-Engine/docs/CONFIGURATION.md`, `Marinara-Engine/docs/TROUBLESHOOTING.md`, and `Marinara-Engine/docs/FAQ.md` together when install, update, or release behavior changes.

## Trivial Change Fast Path

Use this path for an explicitly requested, well-understood change confined to a few lines with no API, database, persistence, security, dependency, or release impact.

1. Do not pause for design approval when the user has already directly instructed implementation.
2. Create the required branch/worktree and minimal CR bookkeeping without turning it into a separate design phase or separate pre-implementation commit.
3. Make the edit and inspect the focused diff.
4. Run at most one focused check when it can catch a realistic mistake. A constants-only styling change may need no pre-merge command beyond diff inspection.
5. Commit, merge to the requested local branch, update the tracker, and clean up the worktree.
6. Build the primary checkout only when needed to place artifacts there for the user's manual validation.

Target elapsed time is minutes, not tens of minutes. Process is a safety mechanism, not the deliverable.

## Branch Purpose

This repository is a fork of the `pastadevs/marinara-engine` project. Keep branch intent clear so local development work stays separate from upstream-ready changes.

- Parent `main`: local tooling and change-request documentation for this workspace.
- Nested `Marinara-Engine/main`: local application development branch for new features and experiments not necessarily intended for upstream use.
- `upstream-main`: clean branch for upstream updates and pull requests into `pastadevs/main`.
- `change/CRXXX`: per-change working branches mapped to a change request, following the change request skill practice.
- `pr/CRXXX`: upstream-ready PR branches created after a change is completed and tested. Strip non-upstream artifacts such as design documents before merging these branches into `upstream-main`.

Use the repo-local skills for detailed project workflows:

- `$marinara-branch-maintenance`: maintain parent tooling, rebuild nested `main` from `upstream-main`, and manage branch strategy.
- `$marinara-change-request`: create and manage `change/CRXXX` branches and `change_requests/` docs.
- `$marinara-coderabbit-review`: triage, verify, plan, and address CodeRabbit PR review comments.
- `$marinara-e2e-validation`: create focused Playwright E2E validation, reusable macros, annotations, and evidence for completed CR work.
- `$marinara-pr-description`: draft or update `change_requests/CRXXX_*/PR.md` from the repository PR template.
- `$marinara-upstream-pr`: prepare clean `pr/CRXXX` branches manually before upstream PR work.

Keep `change_requests/tracker.md` current when CR state changes, including creation, archive/supersession, local merge, PR opening, and PR merge.

Local-only startup helpers live in the parent tools repo and must be stripped from upstream PR branches:

- `start_dev_server_logged.bat`
- `filter_server_log.bat`
- `filter_server_log.ps1`

## Version Truth

- Canonical version: `Marinara-Engine/package.json`
- Release tag format: `vX.Y.Z`
- Release-notes source: `CHANGELOG.md`
- Derived version files that must stay in sync:
  - `Marinara-Engine/packages/client/package.json`
  - `Marinara-Engine/packages/server/package.json`
  - `Marinara-Engine/packages/shared/package.json`
  - `Marinara-Engine/packages/shared/src/constants/defaults.ts`
  - `Marinara-Engine/installer/installer.nsi`
  - `Marinara-Engine/installer/install.bat`
  - `Marinara-Engine/android/app/build.gradle`

Android-specific rule:

- `versionName` matches the app version.
- `versionCode` increments for every shipped APK.

## Safe Multi-File Updates

- When changing version numbers, bump `Marinara-Engine/package.json` first, then run `cd Marinara-Engine && pnpm version:sync -- --android-version-code <next-code>`.
- Run `cd Marinara-Engine && pnpm version:check` before tagging or publishing.
- Keep `Marinara-Engine/CONTRIBUTING.md` authoritative. Add Codex-specific notes here only when they are operationally useful and not already covered there.

## Frontend Changes

- **Read `Marinara-Engine/packages/client/.instructions.md` before editing any client code.** It is the authoritative reference for architecture, patterns, conventions, and common-mistake avoidance.
- For substantive frontend changes, validate with `cd Marinara-Engine && pnpm check` (TypeScript + ESLint). For trivial changes, follow the fast path above.
