---
name: marinara-change-request-worktree
description: Create or retire the dedicated nested application worktree required for a Marinara Engine CR.
---

# Marinara CR Worktree

Read the [shared contract](../marinara-change-request/SHARED_CONTRACT.md). Use this stage before application implementation or after a successful committed handoff.

Start from the approved base and create `change/CRXXX-short-title` in the nested application repository. Add a dedicated temporary worktree for that branch; the nested primary checkout is coordination-only. Before removal, verify `git status --short --branch` is clean in the worktree. Remove it after successful commit and validation unless the user asks to keep it.

Exit with the branch, dedicated worktree location, base, and clean/removal status. Never make product edits in the nested primary checkout.
