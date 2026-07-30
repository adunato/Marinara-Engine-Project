---
name: marinara-branch-maintenance
description: Maintain the local branch model for the Marinara-Engine nested app repo and parent tools repo. Use when Codex needs to synchronize the Pasta-Devs main mirror through the Adunato fork, reset or rebuild nested app main from upstream-main, inspect or update local-only tooling artifacts, or explain this workspace's fork branch strategy.
---

# Marinara Branch Maintenance

Use this skill only in `Marinara-Engine-Project/`, with application Git commands run from the nested `Marinara-Engine/` repo.

## Remote and Branch Model

- Remote `upstream`: `Pasta-Devs/Marinara-Engine`, the authoritative upstream repository.
- Remote `origin`: `adunato/Marinara-Engine`, the development fork.
- `upstream-main`: local clean mirror branch. It tracks `origin/upstream-main`, which mirrors `upstream/main`.
- Parent `main`: local tools, change-request docs, and E2E harness.
- Nested `main`: local application development branch built from `upstream-main` plus completed local changes. It tracks `origin/main` when published.
- `change/CRXXX-*`: working branches for individual change requests.
- `pr/CRXXX-*`: upstream-ready branches containing only the intended CR diff rebased onto `upstream/staging`.

Maintain this invariant:

```text
upstream/main == origin/upstream-main == upstream-main
```

Never merge local development, change, or PR branches into `upstream-main`. Normal Pasta-Devs contributions target `staging`; accepted changes reach this stable mirror only after promotion to Pasta-Devs `main`.

## Git Worktree Discipline

- Make every nested app branch change from a dedicated temporary `git worktree` checked out to the target branch.
- Use the nested `Marinara-Engine/` checkout only to inspect state, create worktrees, and coordinate branch maintenance.
- Commit every completed change before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
- Remove the temporary worktree after the successful commit and validation, unless the user explicitly asks to keep it.
- Before removing a worktree, verify `git status --short --branch` in that worktree is clean.

## Parent Tooling Contents

Keep the parent repo limited to local workflow artifacts:

- `.agents/skills/`
- `.agents/scripts/`
- `AGENTS.md`
- `.gitignore`
- `change_requests/`
- `change_requests/tracker.md`
- `start_dev_client.bat`
- `start_dev_server.bat`
- `start_dev_server_logged.bat`
- `filter_server_log.bat`
- `filter_server_log.ps1`
- `playwright.config.ts`
- `scripts/e2e-dev-server.mjs`
- `tests/e2e/`
- Playwright-only parent `package.json` and lockfile changes

If another local-only artifact is needed, add it deliberately and update `AGENTS.md` in the same change.

## Parent Tools Maintenance

Update parent tooling directly on the parent `main` branch. Do not reintroduce a nested `local-tools` branch; tooling no longer lives inside the app repo. When parent tooling changes affect PR cleanup, update `$marinara-upstream-pr` in the same parent commit.

## Tracker Maintenance

Keep `change_requests/tracker.md` in sync with branch workflow changes. Update it when a CR is created, archived, superseded, merged into `main`, opened as a PR, or merged into the PR target branch.

## Refresh Upstream Mirror Workflow

Treat remote updates as separate from local branch maintenance. A request to inspect, fetch, or repair local tracking does not authorize a push.

1. Fetch both sides and record their exact tips:

   ```powershell
   git fetch upstream main
   git fetch origin upstream-main
   git rev-parse upstream/main origin/upstream-main upstream-main
   ```

2. If local or Adunato `upstream-main` contains fork-only commits, preserve them with an explicit local archive tag before replacing any ref.
3. Create a temporary worktree for local `upstream-main`, verify it is clean, and reset it to the authoritative stable branch:

   ```powershell
   git reset --hard upstream/main
   ```

4. Verify the worktree is clean and remove it.
5. Configure the local branch to track the Adunato mirror without moving the branch:

   ```powershell
   git branch --set-upstream-to=origin/upstream-main upstream-main
   ```

6. Stop unless the user explicitly authorizes remote alignment. When authorized, push `upstream-main` to `origin/upstream-main`. Use a normal push when it is a fast-forward. If the remote contains fork-only history and the user has approved replacing it, use `--force-with-lease` tied to the previously observed remote tip.
7. Fetch again and verify that `upstream/main`, `origin/upstream-main`, and local `upstream-main` resolve to the same commit.

Do not merge `origin/upstream-main` into the local mirror to resolve divergence; that would reintroduce fork-only commits into the clean base.

## Rebuild Main Workflow

Before any destructive operation:

1. Confirm the nested app branch and working tree with `git -C Marinara-Engine status --short --branch`.
2. Preserve or commit unrelated work. Never reset over user changes without explicit instruction.
3. Verify `upstream-main` exists locally in `Marinara-Engine/`.
4. Create a temporary worktree for the branch that will be changed.

To rebuild `main` when explicitly asked:

1. Work from a temporary worktree checked out to `main`.
2. Reset or overwrite nested `main` from `upstream-main` as requested by the user.
3. Do not merge parent tooling into the nested app repo.
4. Resolve conflicts by preserving upstream product code unless the local app branch intentionally changes it.
5. Commit the rebuilt `main` state if the merge or overlay application produces changes.
6. Run `git status --short --branch` and summarize the resulting state.
7. Remove the temporary worktree after validation and commit.
8. If the user wants `origin/main` to match the rebuilt local `main`, publish with `git push --force-with-lease origin main`.

Do not merge `origin/main` into rebuilt nested `main`; that can reintroduce old local development history and product-code conflicts. Use `git push --force-with-lease origin main` from `Marinara-Engine/` to update the remote after explicit user confirmation.
