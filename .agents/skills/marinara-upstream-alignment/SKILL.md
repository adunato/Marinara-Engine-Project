---
name: marinara-upstream-alignment
description: Periodically align the maintained Marinara Engine fork with a newer Pasta-Devs main by refreshing the clean upstream-main mirror and replaying retained canonical CR units one at a time, adapting them to the new upstream architecture while preserving documented behavior.
---

# Marinara Upstream Alignment

Use this skill for periodic adoption of changes from `Pasta-Devs/Marinara-Engine` `main` into the long-lived Adunato fork. This is not an upstream contribution or Pasta-Devs PR workflow.

## Preconditions

- Read parent `AGENTS.md`, `change_requests/tracker.md`, the retained CR HLD/implementation plan, and each available `ALIGNMENT.md`.
- Prefer to run `$marinara-change-request-housekeeping` first when current fork `main` is not already represented by a clear canonical CR patch stack.
- Confirm nested application working trees are clean or preserve unrelated work before any branch movement.
- Record exact local/remote tips before changing refs.
- Enable/use Git rerere when appropriate so repeated conflict resolutions can be reused, but never treat a reused resolution as proof that the resulting behavior is still correct.

## 1. Establish the New External Baseline

1. Fetch `upstream/main`, `origin/upstream-main`, and `origin/main`.
2. Record the old fork `main`, old `upstream-main`, new `upstream/main`, and remote tips.
3. Use `$marinara-branch-maintenance` to make local `upstream-main` equal the new `upstream/main` and, only when authorized, synchronize `origin/upstream-main`.
4. Verify the mirror invariant before replay begins:

   ```text
   upstream/main == origin/upstream-main == upstream-main
   ```

   If remote mirror synchronization is not authorized, record the local/new upstream equality and the outstanding remote difference explicitly rather than pretending the full invariant holds.

## 2. Create an Alignment Candidate

- Preserve the current fork tip with an archive tag before any eventual replacement.
- Create `align/<date>-<upstream-short-sha>` from refreshed `upstream-main` in a dedicated temporary worktree.
- Do not merge old `main` wholesale into the candidate. The retained CR stack is the source of fork-specific behavior.
- Determine replay order from the canonical patch stack and documented dependencies, not CR number alone.

## 3. Replay One CR at a Time

For every retained CR, apply only its canonical commit or ordered commit series to the current alignment candidate. After each CR classify the outcome as exactly one of:

- **reapplied** — applies cleanly with no semantic adaptation;
- **adapted** — behavior is retained but implementation changed to fit the new Pasta-Devs architecture;
- **absorbed** — new upstream already provides the required behavior, so no fork patch remains necessary;
- **blocked** — the documented behavior cannot be safely retained without a material unresolved design or dependency decision.

When conflicts or architectural changes occur:

1. Read the CR's `ALIGNMENT.md`, HLD, implementation plan, relevant tests, and current upstream code.
2. Preserve the documented behavior/invariants rather than mechanically preserving the old diff.
3. Prefer current upstream architecture, APIs, naming, and patterns when they can implement the same fork requirement.
4. Use a bounded design review when adaptation is material. Do not silently expand CR scope.
5. If the requirement has become redundant because upstream now implements it, prove the equivalence and classify the CR as absorbed rather than retaining a no-op compatibility patch.
6. If evidence is insufficient for a safe adaptation, mark the CR blocked and leave the candidate/reconciliation state explicit rather than guessing.

Run the smallest focused validation that proves each replay/adaptation before proceeding when a failure would otherwise contaminate later CR diagnosis.

## 4. Verify the Reconstructed Fork

After all non-blocked CRs are replayed:

- inspect the complete diff from refreshed `upstream-main` to the candidate;
- use `git range-diff` where comparable to distinguish intentional adaptation from accidental patch drift;
- confirm no retained CR was silently omitted and no retired CR was accidentally revived;
- run the integrated validation appropriate to the fork, including `pnpm check` where the repository baseline permits it and focused regressions/E2E for behavior whose implementation changed materially;
- update affected `ALIGNMENT.md` files with new canonical commit evidence and adaptation notes;
- update `change_requests/tracker.md` branch-alignment facts and note CRs that became absorbed or materially adapted.

Do not claim success while any required CR is blocked or final validation has a new unexplained failure.

## 5. Authorized Cutover

Only after the candidate is verified and the user authorizes replacement:

1. Ensure the old fork `main` tip is retained by an annotated archive tag such as `archive/<date>/main-before-upstream-alignment`.
2. Move local nested `main` to the verified `align/*` candidate.
3. Verify clean status, exact commit, and expected diff against refreshed `upstream-main`.
4. If publishing is authorized, update `origin/main`; use a normal push if possible, otherwise `--force-with-lease` tied to the previously observed remote tip.
5. Fetch again and verify local `main`, `origin/main`, and the clean upstream mirror state.
6. Remove the temporary alignment worktree/branch only after the resulting state and documentation are safely recorded.

Exit with old/new upstream commits, old/new fork commits, per-CR replay classifications, adaptations/absorptions/blockers, validation evidence, archive reference, tracker/documentation updates, and publication status.
