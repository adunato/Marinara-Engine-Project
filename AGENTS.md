# AGENTS.md

This file is a thin maintainer note for Codex. The application repository lives in `Marinara-Engine/`; canonical app workflow, validation, and release guidance lives in `Marinara-Engine/CONTRIBUTING.md`.

## Preferred Workflow

- Run app development commands from `Marinara-Engine/`.
- Run `cd Marinara-Engine && pnpm install` only when dependencies are missing or dependency manifests/lockfiles changed. Do not reinstall dependencies as routine validation.
- Run `cd Marinara-Engine && pnpm check` as the baseline validation for substantive or cross-cutting app changes, not automatically for every trivial edit.
- Keep validation proportional. Use the smallest check that can catch a plausible failure, run it once, and stop. Do not repeat broad checks after a timeout or stack lint, typecheck, build, and E2E when they provide redundant evidence.
- After application changes are merged or checked out in the primary `Marinara-Engine/` folder for manual validation, run `cd Marinara-Engine && pnpm build` there before starting the app. Build artifacts created in a temporary worktree do not carry into the primary checkout.
- Never leave a server instance started by Codex running after the task or validation turn. Stop its launcher and child processes, then verify its port is no longer listening before handing work back to the user.
- Run local tool commands, including Playwright E2E harness commands, from this parent repo.
- Use the Phoenix MCP to investigate and troubleshoot LLM behavior, including traces, spans, prompts, and evaluations.
- Use dedicated Codex sub-agents as part of every development workflow, assigning bounded responsibilities and coordinating their findings before handoff.
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
- When preparing a fork PR, make the why explicit in the description so reviewers can see the user problem or rationale, not just the file changes.
- Check `Marinara-Engine/README.md`, `Marinara-Engine/android/README.md`, `Marinara-Engine/CONTRIBUTING.md`, `Marinara-Engine/CHANGELOG.md`, `Marinara-Engine/docs/CONFIGURATION.md`, `Marinara-Engine/docs/TROUBLESHOOTING.md`, and `Marinara-Engine/docs/FAQ.md` together when install, update, or release behavior changes.

## Trivial Change Fast Path

Use this path for an explicitly requested, well-understood change confined to a few lines with no API, database, persistence, security, dependency, or release impact.

1. Do not pause for design approval when the user has already directly instructed implementation.
2. Create the required branch/worktree and minimal CR bookkeeping without turning it into a separate design phase or separate pre-implementation commit.
3. Make the edit and inspect the focused diff.
4. Run at most one focused check when it can catch a realistic mistake. A constants-only styling change may need no pre-merge command beyond diff inspection.
5. Commit, integrate into the requested local branch, update the tracker, and clean up the worktree.
6. Build the primary checkout only when needed to place artifacts there for the user's manual validation.

Target elapsed time is minutes, not tens of minutes. Process is a safety mechanism, not the deliverable.

## Branch Purpose

This repository maintains a long-lived fork of `Pasta-Devs/Marinara-Engine`. Local development is authoritative for fork functionality; Pasta-Devs `main` is the external baseline that is periodically incorporated through a controlled alignment workflow.

- Remote `upstream`: `Pasta-Devs/Marinara-Engine`, the authoritative external upstream repository.
- Remote `origin`: `adunato/Marinara-Engine`, the maintained development fork.
- Parent `main`: local tooling and change-request documentation for this workspace.
- `upstream-main`: local clean mirror of `origin/upstream-main`; the Adunato branch in turn mirrors `upstream/main`. Keep all three refs on the same commit, configure local `upstream-main` to track `origin/upstream-main`, and never add fork development commits to it.
- Nested `Marinara-Engine/main`: maintained fork application branch. Conceptually it is `upstream-main` plus the canonical retained change-request patch stack, and it tracks `origin/main` when published.
- `change/CRXXX-*`: per-change working branches mapped to a change request.
- `housekeep/*`: temporary branches used to reconstruct and verify a cleaner canonical CR patch stack before any history replacement.
- `align/*`: temporary branches created from a refreshed `upstream-main` and used to replay retained CRs onto a newer Pasta-Devs `main` baseline.

The mirror invariant is `upstream/main == origin/upstream-main == upstream-main`. Synchronizing either Adunato remote branch requires explicit user approval; inspecting or updating local tracking configuration does not authorize a push. Upstream contribution and Pasta-Devs `staging` are not part of the active workflow. If upstream contribution is reintroduced later, add a dedicated workflow rather than overloading fork alignment.

Use the repo-local skills for detailed project workflows:

- `$marinara-branch-maintenance`: maintain the clean Pasta-Devs `main` mirror, parent tooling, and branch strategy. It does not rebuild fork `main`; use the alignment skill for that.
- `$marinara-change-request`: the index and shared contract for the decomposed CR workflow; select its intake, planning, worktree, implementation, review, validation, ship, or close stage skill as needed. Parent-root `kangentic.json` is the committed shared board source; its `KANGENTIC_STAGE_MAPPING.md` supplies the lifecycle mapping and schema limits. `.kangentic/config.json` is ignored runtime state. Do not invent unsupported board fields.
- `$marinara-change-request-housekeeping`: inventory existing fork commits, map them to CRs, maintain CR replay contracts, and reconstruct a canonical patch stack before any authorized history rewrite.
- `$marinara-upstream-alignment`: periodically refresh the Pasta-Devs baseline and replay the canonical retained CR stack onto it one CR at a time.
- `$marinara-coderabbit-review`: triage, verify, plan, and address CodeRabbit fork PR review comments.
- `$marinara-e2e-validation`: create focused Playwright E2E validation, reusable macros, annotations, and evidence for completed CR work.
- `$marinara-pr-description`: draft or update `change_requests/CRXXX_*/PR.md` for an Adunato fork PR when requested.

Keep `change_requests/tracker.md` current when CR state changes, including creation, archive/supersession, local integration, fork PR state when used, and periodic upstream alignment outcomes.

## Change Request Stage Roles

The `$marinara-change-request` package is one staged workflow, not a competing workflow adapter. Its committed `kangentic.json` defines `To Do`, Intake, Planning, Worktree, Implementation, Review, Validation, Ship, Close & Archive, and Done. `To Do` and Done are no-agent states; every active stage invokes a supported `spawn_agent` prompt template that specifies the `Luna I` agent parameter and only a top-level Codex role. Intake, worktree, implementation, ship, close, and archive are worker-owned; planning is designer-owned; review is reviewer-owned; validation is validator-owned. The board schema has no native skill/role/agent fields, so templates and `KANGENTIC_STAGE_MAPPING.md` carry that binding. Do not create or modify Codex role profiles for these mappings.

Housekeeping and periodic upstream alignment are repository-maintenance workflows outside the per-CR Kangentic lifecycle. Do not model an alignment run as a normal CR Ship operation.

Local-only startup helpers live in the parent tools repo and must not be copied into the nested application patch stack:

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
- Keep `Marinara-Engine/CONTRIBUTING.md` authoritative for application coding conventions. Add Codex-specific notes here only when they are operationally useful and not already covered there.

## Frontend Changes

- **Read `Marinara-Engine/packages/client/.instructions.md` before editing any client code.** It is the authoritative reference for architecture, patterns, conventions, and common-mistake avoidance.
- For substantive frontend changes, validate with `cd Marinara-Engine && pnpm check` (TypeScript + ESLint). For trivial changes, follow the fast path above.
