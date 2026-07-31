# CR023 — Implementation Plan

## 1. Planner checkpoint

- Add a plan-candidate validator that reports missing required reads before validating JSON structure.
- Run it when the model returns a tool-free candidate inside the existing operation loop.
- On rejection, retain the candidate in conversation history, add trusted corrective feedback with exact missing paths, and continue the same agent run.
- Accept and exit the loop only when the candidate passes.

## 2. Prompt contract

- State that `mind_read_markdown` accepts at most 12 files per call.
- Require exact copying of manifest paths and correction of any failed read before finalizing.

## 3. Validation

- Add a deterministic fake-provider regression covering partial reads, premature finalization, corrective feedback, remaining reads, and successful replacement output.
- Run the focused Character Mind regression and server TypeScript validation.
- Build the integrated primary checkout after merging the committed change.

## Completion

- Implemented in application commit `1188cbdd4` and fast-forwarded into local application `main`.
- The focused Character Mind regression passed, including incomplete-plan recovery through the real runtime loop.
- Server TypeScript validation and the integrated primary-checkout production build passed.
