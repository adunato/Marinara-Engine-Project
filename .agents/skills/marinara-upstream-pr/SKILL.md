---
name: marinara-upstream-pr
description: Prepare Marinara-Engine changes for upstream contribution. Use when Codex needs to turn a completed change/CRXXX-* branch into a clean pr/CRXXX-* branch based on Pasta-Devs staging, strip local-only artifacts, validate the upstream-ready diff, or prepare a PR to Pasta-Devs staging.
---

# Marinara Upstream PR

Use this skill only in `Marinara-Engine-Project/`, with application Git commands run from the nested `Marinara-Engine/` repo.

## Branch Intent

- Source work comes from `change/CRXXX-*`.
- Upstream-ready work goes to `pr/CRXXX-*`.
- `upstream-main` is the clean stable mirror of `origin/upstream-main` and `upstream/main`; it is not a PR integration branch.
- Normal upstream PRs target `upstream/staging`, following the canonical nested `AGENTS.md` and `CONTRIBUTING.md`.
- Parent tooling and nested `main` may contain local-only artifacts that must not leak upstream.

## Git Worktree Discipline

- Make every PR-preparation change from a dedicated temporary nested app `git worktree` checked out to the branch being changed.
- Use the nested `Marinara-Engine/` checkout only to inspect state, create worktrees, and coordinate branch movement.
- Commit every completed change before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
- Remove the temporary worktree after the successful commit and validation, unless the user explicitly asks to keep it.
- Before removing a worktree, verify `git status --short --branch` in that worktree is clean.

## Local-Only Artifacts To Strip

Compare every candidate against `upstream/staging`; do not classify a path as local-only by name alone. Pasta-Devs currently owns `.agents/`, `AGENTS.md`, and `playwright.config.ts`, so preserve their upstream versions and any intentional CR changes.

Remove parent-workspace artifacts that are absent from `upstream/staging`, including:

- `change_requests/`
- `start_dev_client.bat`
- `start_dev_server.bat`
- `start_dev_server_logged.bat`
- `filter_server_log.bat`
- `filter_server_log.ps1`
- `scripts/e2e-dev-server.mjs`
- `tests/e2e/`
- parent-only `.agents` children not present upstream
- Playwright-only parent `package.json`, lockfile, or `.gitignore` changes
- design documents, scratch notes, or utility scripts not intended for Pasta-Devs

## PR Branch Workflow

1. Confirm the completed CR branch and the intended CR number.
2. Read parent `change_requests/tracker.md` and confirm the CR is active, not `archived`.
3. Fetch the stable and development bases:

   ```powershell
   git fetch upstream main staging
   git fetch origin upstream-main
   ```

4. Verify the stable mirror invariant. If it is not satisfied, use `$marinara-branch-maintenance`; do not mix mirror repair into the PR branch.
5. Inspect the completed change history and identify the exact base commit before the CR began. Create or replace the PR branch only after confirming replacement with the user:

   ```powershell
   git branch -f pr/CRXXX-short-title change/CRXXX-short-title
   git worktree add <temporary-path> pr/CRXXX-short-title
   ```

6. In the PR worktree, rebase only the CR commit range onto current Pasta-Devs `staging`:

   ```powershell
   git rebase --onto upstream/staging <verified-cr-base>
   ```

   Use `--rebase-merges` when preserving intentional CR merge structure. Resolve conflicts by preserving current `staging` behavior unless the CR intentionally changes it. Confirm that unrelated local `main` commits were not replayed.

7. Remove local-only artifacts from the PR branch:

   ```powershell
   git rm -r --ignore-unmatch -- change_requests start_dev_client.bat start_dev_server.bat start_dev_server_logged.bat filter_server_log.bat filter_server_log.ps1 scripts/e2e-dev-server.mjs tests/e2e
   git diff --name-status upstream/staging -- .agents AGENTS.md .gitignore playwright.config.ts package.json pnpm-lock.yaml
   ```

   If any listed path is untracked, remove it from the working tree after confirming it is one of the local-only
   artifacts above.

   Restore individual upstream-owned files from `upstream/staging` only when their differences are unrelated local tooling. Preserve canonical upstream content and intentional CR changes; never restore or remove the whole `.agents` tree blindly.

8. Commit the PR-branch cleanup if it produces changes, then review the upstream diff:

   ```powershell
   git diff --name-status upstream/staging..HEAD
   ```

   Confirm local-only artifacts are absent and verify the diff does not remove unrelated upstream features.

9. Run `cd Marinara-Engine && pnpm check`.
10. Run additional validation required by the touched areas, such as `cd Marinara-Engine && pnpm db:push` or `cd Marinara-Engine && pnpm version:check`.
11. Confirm whether focused Playwright E2E validation was already agreed and run for the completed CR. If not, ask the user whether to generate and run a CR-specific E2E series using `$marinara-e2e-validation`; do not add broad regression coverage unless explicitly requested.
12. Add the Pasta-Devs PR URL and `staging` target to the tracker notes when the PR is actually opened. Do not describe it as a PR into `origin/main`.
13. Commit all completed PR-preparation changes before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
14. Verify the PR worktree is clean, then remove it unless the user explicitly asks to keep it.
15. Never merge the PR branch into `upstream-main`. After Pasta-Devs accepts the PR into `staging`, retain the PR reference until the user is satisfied; the stable mirror receives the change later when Pasta-Devs promotes it to `main`.

This workflow is intentionally manual. Keep the branch movement, rebase, artifact removal, diff review, and validation
visible in the session instead of hiding them in a helper script.

## PR Description Guidance

Make the why explicit. Include:

- user problem or rationale
- concise implementation summary
- validation performed
- known limitations or follow-up work

Do not push or create the GitHub PR unless the user explicitly asks.
