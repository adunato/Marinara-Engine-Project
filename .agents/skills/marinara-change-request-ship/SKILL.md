---
name: marinara-change-request-ship
description: Normalize validated Marinara Engine CR work into replayable fork history and prepare authorized local integration or release artifacts.
---

# Marinara CR Ship

Read the [shared contract](../marinara-change-request/SHARED_CONTRACT.md). Use this stage after implementation and validation to make the CR a clean long-lived fork change unit. Do not perform periodic upstream alignment here.

## Canonicalize the CR

1. Confirm the approved HLD/implementation plan, completed implementation commits, validation evidence, and intended destination.
2. Review the CR commit range. Consolidate WIP, fixup, debugging, formatting-only, and review-response commits when they are implementation history rather than meaningful design boundaries.
3. Prefer one canonical application commit per CR. Keep a small ordered commit series only when the separation materially improves replay, review, or rollback.
4. Preserve authorship and meaningful commit messages. Do not combine unrelated CRs merely because they touch the same files.
5. If canonicalization requires rewriting a branch that has already been published, require explicit user authority before moving the remote branch or force-pushing it.

## Maintain the Replay Contract

Create or refresh `change_requests/CRXXX_short_title/ALIGNMENT.md` with concise future-alignment information:

- canonical application commit or ordered commit series;
- original fork/upstream baseline when known;
- CR dependencies and required replay order constraints;
- behavior and invariants that must survive a future Pasta-Devs alignment;
- important architecture/design choices that should not be inferred again from the diff;
- likely integration touchpoints or subsystems;
- focused validation evidence that proves the retained behavior.

Do not duplicate the full HLD or implementation plan. `ALIGNMENT.md` is the CR's replay contract, not another design document.

## Prepare Fork Integration

- Normal destination is nested fork `main`, not Pasta-Devs `staging`.
- Keep fork history linear where practical. If the CR branch is based directly on current `main`, prefer a fast-forward after canonicalization. If `main` advanced, rebase the canonical CR units onto current `main` in the dedicated worktree before integration rather than creating an unnecessary merge commit.
- Integrate only when the user's request grants that authority. Otherwise leave the canonical branch and artifacts ready for integration.
- After authorized integration, update the tracker with the resulting `main` state and canonical commit evidence.
- For a fork PR rather than direct local integration, prepare `$marinara-pr-description` when requested; do not create or publish the PR without authority.
- For a release, follow the version truth and synchronization rules in parent `AGENTS.md`, including required version checks.

Exit with the canonical commit structure, `ALIGNMENT.md` path/status, exact validation state, prepared/integrated fork destination, and any authority still required for publishing or release.
