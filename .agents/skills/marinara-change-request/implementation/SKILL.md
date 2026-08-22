---
name: marinara-change-request-implementation
description: Implement approved Marinara Engine CR work in its dedicated nested application worktree.
---

# Marinara CR Implementation

Read the [shared contract](../SHARED_CONTRACT.md), parent `AGENTS.md`, and the approved HLD/plan before editing. Read `packages/client/.instructions.md` before any client edit.

Implement only the approved scope in the dedicated temporary nested worktree. Preserve unrelated changes, keep shared contracts and consumers aligned, add focused regression coverage where practical, and commit completed work unless the user explicitly asks to leave it uncommitted. Escalate rather than silently expanding scope or redesigning a shared contract.

Exit with committed scoped changes, focused diff evidence, and a validation handoff. For a direct trivial request, use the shared fast path instead of unnecessary CR ceremony.
