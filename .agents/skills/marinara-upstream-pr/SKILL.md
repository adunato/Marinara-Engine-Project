---
name: marinara-upstream-pr
description: Prepare Marinara-Engine changes for upstream contribution. Use when Codex needs to turn a completed change/CRXXX-* branch into a clean pr/CRXXX-* branch, strip local-only artifacts, validate the upstream-ready diff, merge into upstream-main, or prepare a PR to pastadevs/main.
---

# Marinara Upstream PR

Use this skill only in `Marinara-Engine-Project/`, with application Git commands run from the nested `Marinara-Engine/` repo.

## Branch Intent

- Source work comes from `change/CRXXX-*`.
- Upstream-ready work goes to `pr/CRXXX-*`.
- `upstream-main` is the clean integration branch for upstream PRs into `pastadevs/main`.
- Parent tooling and nested `main` may contain local-only artifacts that must not leak upstream.

## Git Worktree Discipline

- Make every PR-preparation change from a dedicated temporary nested app `git worktree` checked out to the branch being changed.
- Use the nested `Marinara-Engine/` checkout only to inspect state, create worktrees, and coordinate branch movement.
- Commit every completed change before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
- Remove the temporary worktree after the successful commit and validation, unless the user explicitly asks to keep it.
- Before removing a worktree, verify `git status --short --branch` in that worktree is clean.

## Local-Only Artifacts To Strip

Remove these from `pr/CRXXX-*` unless the user explicitly requests otherwise. Most should now only exist in the parent repo; still strip them if they were copied into an app branch:

- `.agents/skills/`
- `.agents/scripts/`
- `AGENTS.md`
- `change_requests/`
- `start_dev_client.bat`
- `start_dev_server.bat`
- `start_dev_server_logged.bat`
- `filter_server_log.bat`
- `filter_server_log.ps1`
- `playwright.config.ts`
- `scripts/e2e-dev-server.mjs`
- `tests/e2e/`
- Playwright-only `package.json` and lockfile changes
- local-only `.gitignore` changes
- design documents, scratch notes, or utility scripts not intended for `pastadevs/main`

## PR Branch Workflow

1. Confirm the completed CR branch and the intended CR number.
2. Read parent `change_requests/tracker.md` and confirm the CR is active, not `archived`.
3. Create a temporary worktree for `upstream-main` and refresh it from `Pasta-Devs/Marinara-Engine`:

   ```powershell
   git fetch upstream main
   git reset --hard upstream/main
   ```

4. Remove the `upstream-main` worktree after the refresh.
5. Create a temporary worktree for the completed change branch and rebase it onto refreshed `upstream-main`:

   ```powershell
   git rebase upstream-main
   ```

   Resolve conflicts by preserving current upstream behavior unless the CR intentionally changes it. Do not use
   cherry-pick as a substitute for this workflow.

6. Complete the rebase, verify the change-branch worktree is clean, then remove it unless continuing directly into PR branch creation.
7. Create a temporary worktree for the PR branch copied from the rebased change branch:

   ```powershell
   git branch -f pr/CRXXX-short-title change/CRXXX-short-title
   git worktree add <temporary-path> pr/CRXXX-short-title
   ```

   If the PR branch already exists, confirm with the user before replacing it.

8. Remove local-only artifacts from the PR branch:

   ```powershell
   git rm -r --ignore-unmatch -- .agents AGENTS.md change_requests start_dev_client.bat start_dev_server.bat start_dev_server_logged.bat filter_server_log.bat filter_server_log.ps1 playwright.config.ts scripts/e2e-dev-server.mjs tests/e2e
   git restore --source upstream-main -- .gitignore
   git restore --source upstream-main -- package.json pnpm-lock.yaml
   ```

   If any listed path is untracked, remove it from the working tree after confirming it is one of the local-only
   artifacts above.

9. Commit the PR-branch cleanup if it produces changes, then review the upstream diff:

   ```powershell
   git diff --name-status upstream-main..HEAD
   ```

   Confirm local-only artifacts are absent and verify the diff does not remove unrelated upstream features.

10. Run `cd Marinara-Engine && pnpm check`.
11. Run additional validation required by the touched areas, such as `cd Marinara-Engine && pnpm db:push` or `cd Marinara-Engine && pnpm version:check`.
12. Confirm whether focused Playwright E2E validation was already agreed and run for the completed CR. If not, ask the user whether to generate and run a CR-specific E2E series using `$marinara-e2e-validation`; do not add broad regression coverage unless explicitly requested.
13. Update `change_requests/tracker.md` when the CR status changes:
   - `PR open into origin main` after a PR is actually opened into the target main branch.
   - `merged into origin main` after that PR is merged.
   - Add the PR URL or target branch in `Notes` when known.
14. Commit all completed PR-preparation changes before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
15. Verify the PR worktree is clean, then remove it unless the user explicitly asks to keep it.
16. Merge into `upstream-main` only after the user confirms the PR branch is ready.

This workflow is intentionally manual. Keep the branch movement, rebase, artifact removal, diff review, and validation
visible in the session instead of hiding them in a helper script.

## PR Description Guidance

Make the why explicit. Include:

- user problem or rationale
- concise implementation summary
- validation performed
- known limitations or follow-up work

Do not push or create the GitHub PR unless the user explicitly asks.
