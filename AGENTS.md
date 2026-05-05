# AGENTS.md

This file is a thin maintainer note for contributors using Codex. The application repository lives in `Marinara-Engine/`; canonical app workflow, validation, and release guidance lives in `Marinara-Engine/CONTRIBUTING.md`.

## Preferred Workflow

- Run app development commands from `Marinara-Engine/`.
- Start app work with `cd Marinara-Engine && pnpm install`.
- Run `cd Marinara-Engine && pnpm check` as the baseline app validation command.
- Run local tool commands, including Playwright E2E harness commands, from this parent repo.
- After a change request implementation is complete, agree with the user whether to generate and run focused Playwright E2E validation for that CR. Do not add broad regression coverage unless explicitly requested.
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
- Validate with `cd Marinara-Engine && pnpm check` (TypeScript + ESLint).
