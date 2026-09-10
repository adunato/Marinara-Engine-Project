# Marinara Change Request Shared Contract

All `$marinara-change-request-*` stage skills use this contract. Use them only in `Marinara-Engine-Project/`. Keep CR documents in the parent repository; run application Git and validation commands from `Marinara-Engine/` or its dedicated temporary worktree.

## Boundaries and Required Artifacts

- Read parent `AGENTS.md` first. Before client edits, read `Marinara-Engine/packages/client/.instructions.md`.
- Each active CR folder is `change_requests/CRXXX_short_title/` and contains `HLD.md` and `IMPLEMENTATION_PLAN.md`.
- A behavior-bearing CR that is prepared for integration into fork `main` should also have `ALIGNMENT.md`, created or refreshed by Ship. Historical CRs do not need bulk backfilling outside `$marinara-change-request-housekeeping`.
- Branches are named `change/CRXXX-short-title`. Do not make application changes in the nested primary checkout: create a dedicated temporary nested application worktree, commit completed work, verify it is clean before removal, and remove it after successful validation unless the user asks to keep it.
- Keep `change_requests/tracker.md` current on creation, archival, supersession, local-main integration, and fork PR state when fork PRs are used. Archived documents move to `change_requests/archive/CRXXX_short_title/`; do not resume active work there. Record supersession in the tracker notes.
- Do not push, publish, open or merge PRs, rewrite shared history, or change tracker/CR lifecycle without the authority granted by the request.

## Bases and Approval

- Start normal local development from nested `main` unless the user specifies another base. `upstream-main` is a clean external baseline, not the normal CR development branch.
- Before work that explicitly requires the latest Pasta-Devs baseline, use `$marinara-branch-maintenance` to verify the mirror. Use `$marinara-upstream-alignment` for periodic adoption of a newer Pasta-Devs `main`; do not turn an individual CR into an implicit fork-alignment operation.
- Ask for HLD approval before implementation when design is unresolved. A direct instruction to implement a clear change is approval.
- Upstream contribution and Pasta-Devs `staging` are outside the active CR workflow.

## Planning and Validation Minimums

- HLD: title, status, goals, proposed solution, risks, and validation.
- Implementation plan: prerequisites, atomic tasks, files affected, verification, and rollback.
- `ALIGNMENT.md`: canonical commit or commit series, base/dependencies, behavior that must survive future upstream alignment, important architectural decisions, likely integration touchpoints, and validation evidence. Keep it concise and avoid duplicating the HLD.
- Run `pnpm check` for substantive or cross-cutting changes. Follow the parent trivial-change fast path for trivial, constants-only, or narrowly visual changes.
- Run `pnpm db:push` for relevant server/database schema verification and `pnpm version:check` for release metadata or version-bearing changes.
- After behavior-bearing work, agree with the user whether to add focused Playwright E2E validation via `$marinara-e2e-validation`; do not force that discussion for trivial visual/constants-only work. Do not add broad E2E coverage without an explicit request.
- When E2E is agreed, place CR-specific specs under `tests/e2e/specs/change-requests/CRXXX/`, prefix names with `[api]` or `[ui]`, expose reusable macros through `test.step()`, and attach useful annotations, JSON evidence, screenshots, and server-log snippets.

## Trivial Change Fast Path

For a directly instructed, well-understood change confined to a few lines with no API, database, persistence, security, dependency, or release impact, combine CR initialization and completion bookkeeping into one minimal parent-repo commit after implementation. Do not create a documentation-only checkpoint or a separate approval round. Inspect the focused diff and run at most one focused check when it can catch a realistic mistake. If the change is integrated into fork `main`, retain enough replay intent in `ALIGNMENT.md` to identify the canonical patch and expected behavior.
