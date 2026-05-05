---
name: marinara-change-request
description: Create and manage Marinara-Engine change requests. Use when Codex needs to start a new CR, create change_requests/CRXXX_* documentation, create a change/CRXXX-* branch, draft or update HLD and implementation plans, or align work with this project's change request practice.
---

# Marinara Change Request

Use this skill only in `Marinara-Engine-Project/`. Keep CR docs in the parent repo and run application Git commands from `Marinara-Engine/`.

This project also has the generic `change-request` skill. Follow that structure, with these Marinara-specific rules.

## CR Numbering

1. Inspect parent `change_requests/tracker.md`, active `change_requests/CRXXX_*` folders, and archived `change_requests/archive/CRXXX_*` folders.
2. Pick the next `CRXXX` number after the highest existing tracked, active, or archived CR.
3. Use folder names like `change_requests/CR003_short_title`.
4. Use branch names like `change/CR003-short-title`.

## Required Files

Each CR folder must contain:

- `HLD.md`
- `IMPLEMENTATION_PLAN.md`

Keep these files in the parent repo. Remove any copied CR docs from upstream PR branches unless the user explicitly wants the docs included upstream.

## Git Worktree Discipline

- Make every application CR branch change from a dedicated temporary `git worktree` checked out to the target branch in `Marinara-Engine/`.
- Use the nested primary checkout only to inspect state, create worktrees, and coordinate branch movement.
- Commit every completed change before handing work back to the user, unless the user explicitly asks to leave changes uncommitted.
- Remove the temporary worktree after the successful commit and validation, unless the user explicitly asks to keep it.
- Before removing a worktree, verify `git status --short --branch` in that worktree is clean.

## New CR Workflow

1. Start from the appropriate base branch. Use `main` for local development unless the user specifies otherwise.
2. If the new CR should be based on `upstream-main`, first fetch `upstream main` and fast-forward local `upstream-main` to `upstream/main`.
3. Create `change/CRXXX-short-title` in the nested app repo when application implementation is expected.
4. Add a temporary nested app worktree checked out to `change/CRXXX-short-title`.
5. Create parent `HLD.md` with title, status, goals, proposed solution, risks, and validation.
6. Create parent `IMPLEMENTATION_PLAN.md` with prerequisites, atomic tasks, files affected, verification, and rollback.
7. Update `change_requests/tracker.md` with the new CR title, `standalone` state, short description, dependencies, and notes.
8. Commit the CR docs and tracker update in the parent repo with a message like `docs: init CRXXX short title`.
9. Remove the temporary worktree after the successful commit and validation unless the user is continuing directly into approved implementation work there.
10. Ask for HLD approval before writing implementation code when starting a brand-new change.

## Tracker Rules

Keep `change_requests/tracker.md` current when a CR is created, archived, superseded, merged into `main`, opened as a PR, or merged into the PR target branch.

- Use `archived` when a CR is retained for reference only.
- Move archived CR docs under `change_requests/archive/CRXXX_short_title/`.
- Record supersession in the tracker `Notes` column, such as `Superseded by CR004`.
- Do not continue active work in archived CR folders.

## Implementation Rules

- Read `AGENTS.md` first.
- Read `Marinara-Engine/packages/client/.instructions.md` before editing client code.
- Use `cd Marinara-Engine && pnpm check` as the baseline validation command.
- Use `cd Marinara-Engine && pnpm db:push` when server or database schema behavior changes.
- Use `cd Marinara-Engine && pnpm version:check` when touching release metadata or version-bearing files.
- After implementation work is complete, agree with the user whether to generate and run focused Playwright E2E validation for the CR using `$marinara-e2e-validation`.
- Do not add broad regression E2E coverage unless the user explicitly asks for it.
- If E2E validation is agreed, keep CR-specific specs under `tests/e2e/specs/change-requests/CRXXX/`, use `[api]` or `[ui]` test-name prefixes, expose reusable macros as `test.step()` entries, and attach reviewer evidence through annotations, JSON payloads, screenshots where practical, and server-log snippets.
