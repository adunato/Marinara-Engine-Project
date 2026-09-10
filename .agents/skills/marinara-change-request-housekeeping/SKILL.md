---
name: marinara-change-request-housekeeping
description: Normalize the maintained Marinara Engine fork into documented, replayable change-request units. Use to inventory upstream-main..main, map commits to CRs, consolidate implementation history, maintain ALIGNMENT.md replay contracts, and prove a reconstructed patch stack before any authorized history rewrite.
---

# Marinara Change Request Housekeeping

Use this skill in `Marinara-Engine-Project/` when the fork's existing history needs to be prepared for future periodic alignment with Pasta-Devs. Application Git operations run in the nested `Marinara-Engine/` repository or a dedicated temporary worktree.

## Goal

Make nested fork `main` conceptually reproducible as:

```text
current upstream-main baseline
+ canonical retained CR unit 1
+ canonical retained CR unit 2
+ ...
```

The deliverable is not prettier history by itself. The deliverable is a patch stack whose intent, dependency order, and validation can be understood and replayed without reverse-engineering old development commits.

## Safety and Authority

- Treat assessment and candidate reconstruction as non-destructive.
- Never add fork commits to `upstream-main`.
- Never rewrite local `main`, move `origin/main`, or force-push a published branch without explicit user authority.
- Preserve the exact pre-housekeeping `main` tip with an annotated archive tag before any authorized replacement.
- Use `--force-with-lease` against the previously observed remote tip when a published fork branch is intentionally replaced.
- Preserve unrelated dirty work and use dedicated temporary worktrees.

## Inventory and Classification

1. Verify/fetch the current `upstream-main`, `main`, and relevant remote tips without moving them.
2. Inspect `upstream-main..main` in chronological/topological order and map every behavior-bearing commit to a CR.
3. Use CR HLDs, implementation plans, tracker notes, branch history, PR/review evidence, diffs, and tests to establish intent. Do not infer ownership from commit-message text alone when the evidence conflicts.
4. Classify commits as:
   - canonical CR behavior;
   - fixup/review/debug history belonging to a CR;
   - shared prerequisite/dependency that must have an explicit owner/order;
   - accidental/noise-only change;
   - orphan that cannot yet be assigned safely.
5. Record CR dependencies and replay-order constraints. Do not assume numeric CR order is sufficient.
6. Do not combine distinct CRs just because their implementations overlap. If two CRs have become inseparable, document the dependency explicitly before considering consolidation.

## Canonical CR Units

For each retained CR:

- Prefer one canonical commit containing the final intended behavior.
- Keep a small ordered series when separate commits represent meaningful contracts, migrations, or rollback boundaries.
- Fold WIP, fixup, debugging, mechanical cleanup, and review-response commits into the owning canonical unit when they do not represent independent behavior.
- Preserve the final application behavior, not the chronology of how it was discovered.
- Keep parent-only workflow/docs artifacts outside the nested application patch stack.

Create or refresh the CR's `ALIGNMENT.md` with:

- canonical commit(s);
- baseline and dependencies;
- behavioral invariants that must survive alignment;
- important architectural decisions;
- likely integration touchpoints;
- focused validation evidence;
- any known coupling or uncertainty relevant to replay.

Archived CR documentation may receive `ALIGNMENT.md` when its implementation remains part of the maintained fork; do not unarchive it merely to add the replay contract.

## Candidate Reconstruction

1. Create a temporary `housekeep/<date>-<main-short-sha>` branch from the current clean `upstream-main` baseline.
2. Replay the proposed canonical CR units in dependency order.
3. Resolve only housekeeping-induced structural issues; do not redesign product behavior during this exercise.
4. Compare the reconstructed candidate with the existing `main` final tree. A clean tree equivalence is the default requirement unless the user explicitly approves deliberate cleanup differences.
5. Use `git range-diff` or equivalent commit/diff comparison where useful to show how development history maps to the canonical series.
6. Run proportionate focused validation plus the final integrated checks appropriate to the touched fork surface.
7. Produce a concise reconciliation report: retained CR order, canonical commits, folded/orphan commits, tree differences, validation result, and blockers.

## Authorized Replacement

Only after the candidate is proven and the user authorizes replacement:

1. Tag the old `main` tip as `archive/<date>/main-before-housekeeping` or another explicitly agreed archive name.
2. Move local `main` to the verified candidate.
3. Re-run final status/diff checks after branch movement.
4. If publication is authorized, update `origin/main` with a normal push when possible or `--force-with-lease` when the history rewrite requires it.
5. Fetch and verify the exact resulting local/remote tips.
6. Update `change_requests/tracker.md` and affected `ALIGNMENT.md` files with canonical commit evidence.

Exit with the canonical CR sequence, candidate/final branch and commit, equivalence/validation evidence, documentation changes, archive reference, and any remaining orphan or blocked commits.
