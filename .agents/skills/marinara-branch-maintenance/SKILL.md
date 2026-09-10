---
name: marinara-branch-maintenance
description: Maintain the local branch model and clean Pasta-Devs main mirror for the Marinara-Engine fork. Use when Codex needs to inspect or synchronize upstream-main, repair tracking, maintain parent tooling, or explain the workspace branch strategy. Periodic rebuilding of fork main belongs to marinara-upstream-alignment.
---

# Marinara Branch Maintenance

Use this skill only in `Marinara-Engine-Project/`, with application Git commands run from the nested `Marinara-Engine/` repo.

## Remote and Branch Model

- Remote `upstream`: `Pasta-Devs/Marinara-Engine`, the authoritative external upstream repository.
- Remote `origin`: `adunato/Marinara-Engine`, the maintained development fork.
- `upstream-main`: local clean mirror branch. It tracks `origin/upstream-main`, which mirrors `upstream/main`.
- Parent `main`: local tools, change-request docs, and E2E harness.
- Nested `main`: maintained fork application branch, conceptually `upstream-main` plus the canonical retained CR patch stack.
- `change/CRXXX-*`: working branches for individual change requests.
- `housekeep/*`: temporary patch-stack reconstruction branches.
- `align/*`: temporary periodic upstream-alignment branches.

Maintain this invariant:

```text
upstream/main == origin/upstream-main == upstream-main
```

Never merge local development, CR, housekeeping, or alignment commits into `upstream-main`. Upstream contribution and Pasta-Devs `staging` are outside the active workflow.

## Git Worktree Discipline

- Make every nested app branch change from a dedicated temporary `git worktree` checked out to the target branch.
- Use the nested `Marinara-Engine/` checkout only to inspect state, create worktrees, and coordinate branch maintenance.
- Commit every completed change before handing work back to the user, unless the user explicitly asks to leave it uncommitted.
- Remove the temporary worktree after the successful commit and validation, unless the user explicitly asks to keep it.
- Before removing a worktree, verify `git status --short --branch` in that worktree is clean.

## Parent Tooling Contents

Keep the parent repo limited to local workflow artifacts:

- `.agents/skills/`
- `.agents/scripts/`
- `.codex/`
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

Update parent tooling directly on the parent `main` branch. Do not reintroduce a nested `local-tools` branch; tooling no longer lives inside the app repo. Keep workflow documentation synchronized when branch or alignment policy changes.

## Tracker Maintenance

Keep `change_requests/tracker.md` in sync with branch workflow changes. Update it when a CR is created, archived, superseded, integrated into `main`, changes fork PR state when fork PRs are used, or is reclassified during periodic upstream alignment.

## Refresh Upstream Mirror Workflow

Treat remote updates as separate from fork reconstruction. A request to inspect, fetch, or repair local tracking does not authorize a push or authorize replacing fork `main`.

1. Fetch both sides and record their exact tips:

   ```powershell
   git fetch upstream main
   git fetch origin upstream-main
   git rev-parse upstream/main origin/upstream-main upstream-main
   ```

2. If local or Adunato `upstream-main` contains fork-only commits, preserve them with an explicit local archive tag before replacing any ref.
3. Create a temporary worktree for local `upstream-main`, verify it is clean, and reset it to the authoritative external stable branch:

   ```powershell
   git reset --hard upstream/main
   ```

4. Verify the worktree is clean and remove it.
5. Configure the local branch to track the Adunato mirror without moving the branch:

   ```powershell
   git branch --set-upstream-to=origin/upstream-main upstream-main
   ```

6. Stop unless the user explicitly authorizes remote mirror synchronization. When authorized, push `upstream-main` to `origin/upstream-main`. Use a normal push when it is a fast-forward. If the remote contains fork-only history and the user has approved replacing it, use `--force-with-lease` tied to the previously observed remote tip.
7. Fetch again and verify that `upstream/main`, `origin/upstream-main`, and local `upstream-main` resolve to the same commit.

Do not merge `origin/upstream-main` into the local mirror to resolve divergence; that would reintroduce fork-only commits into the clean base.

## Alignment Boundary

Refreshing the mirror does not itself change nested `main`. When Pasta-Devs `main` has advanced and the maintained fork must adopt it, hand off to `$marinara-upstream-alignment` after the mirror state is known. That skill owns the temporary `align/*` branch, sequential CR replay/adaptation, validation, preservation of the old fork tip, and any authorized replacement of local or remote fork `main`.

Do not reset or rebuild nested `main` as a shortcut for alignment. Do not merge `origin/main` into a reconstructed alignment branch; replay the canonical CR units instead.
