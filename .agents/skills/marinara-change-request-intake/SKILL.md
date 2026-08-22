---
name: marinara-change-request-intake
description: Open or register a Marinara Engine change request with correct parent-repository records.
---

# Marinara CR Intake

Read the [shared contract](../marinara-change-request/SHARED_CONTRACT.md). Use this stage to create or register a CR, not to implement it.

1. Inspect `change_requests/tracker.md`, active `change_requests/CRXXX_*`, and archived `change_requests/archive/CRXXX_*`; choose the next number after the highest existing CR.
2. Create `change_requests/CRXXX_short_title/` with `HLD.md` and `IMPLEMENTATION_PLAN.md`, and name the app branch `change/CRXXX-short-title` when implementation is expected.
3. Update the tracker with title, `standalone` state, short description, dependencies, and notes.
4. Commit authorized parent CR documentation with `docs: init CRXXX short title` unless the trivial fast path applies.

Exit with the CR identifier, parent artifact paths, tracker state, base/branch intent, and whether planning approval is required. Do not create an application worktree here; use `$marinara-change-request-worktree`.
