# Marinara Change Request Shared Contract

All `$marinara-change-request-*` stage skills use this contract. Use them only in `Marinara-Engine-Project/`. Keep CR documents in the parent repository; run application Git and validation commands from `Marinara-Engine/` or its dedicated temporary worktree.

## Boundaries and Required Artifacts

- Read parent `AGENTS.md` first. Before client edits, read `Marinara-Engine/packages/client/.instructions.md`.
- Each active CR folder is `change_requests/CRXXX_short_title/` and contains `HLD.md` and `IMPLEMENTATION_PLAN.md`. Keep these parent-repo artifacts out of upstream PR branches unless explicitly requested.
- Branches are named `change/CRXXX-short-title`. Do not make application changes in the nested primary checkout: create a dedicated temporary nested application worktree, commit completed work, verify it is clean before removal, and remove it after successful validation unless the user asks to keep it.
- Keep `change_requests/tracker.md` current on creation, archival, supersession, local-main integration, PR opening, and PR merge. Archived documents move to `change_requests/archive/CRXXX_short_title/`; do not resume active work there. Record supersession in the tracker notes.
- Do not push, publish, open or merge PRs, or change tracker/CR lifecycle without the authority granted by the request.

## Bases and Approval

- Start local development from `main` unless the user specifies another base. Before a stable-release-base CR, use `$marinara-branch-maintenance` and verify `upstream/main == origin/upstream-main == upstream-main`; do not make local `upstream-main` track Pasta-Devs directly or add CR commits to it.
- Ask for HLD approval before implementation when design is unresolved. A direct instruction to implement a clear change is approval.
- For an upstream contribution, use `$marinara-upstream-pr` to create a separate `pr/CRXXX-*` branch based on `upstream/staging`; keep local-main integration separate and strip local-only parent tools and copied CR artifacts.

## Planning and Validation Minimums

- HLD: title, status, goals, proposed solution, risks, and validation.
- Implementation plan: prerequisites, atomic tasks, files affected, verification, and rollback.
- Run `pnpm check` for substantive or cross-cutting changes. Follow the parent trivial-change fast path for trivial, constants-only, or narrowly visual changes.
- Run `pnpm db:push` for relevant server/database schema verification and `pnpm version:check` for release metadata or version-bearing changes.
- After behavior-bearing work, agree with the user whether to add focused Playwright E2E validation via `$marinara-e2e-validation`; do not force that discussion for trivial visual/constants-only work. Do not add broad E2E coverage without an explicit request.
- When E2E is agreed, place CR-specific specs under `tests/e2e/specs/change-requests/CRXXX/`, prefix names with `[api]` or `[ui]`, expose reusable macros through `test.step()`, and attach useful annotations, JSON evidence, screenshots, and server-log snippets.

## Trivial Change Fast Path

For a directly instructed, well-understood change confined to a few lines with no API, database, persistence, security, dependency, or release impact, combine CR initialization and completion bookkeeping into one minimal parent-repo commit after implementation. Do not create a documentation-only checkpoint or a separate approval round. Inspect the focused diff and run at most one focused check when it can catch a realistic mistake.
