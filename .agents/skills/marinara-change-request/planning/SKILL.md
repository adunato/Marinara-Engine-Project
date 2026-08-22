---
name: marinara-change-request-planning
description: Create or refine the approved design and implementation plan for a Marinara Engine change request.
---

# Marinara CR Planning

Read the [shared contract](../SHARED_CONTRACT.md). Use this stage for HLD and implementation-plan work only.

Ensure `HLD.md` states the title, status, goals, proposed solution, risks, and validation. Ensure `IMPLEMENTATION_PLAN.md` records prerequisites, atomic tasks, affected files, verification, and rollback. Keep plans aligned with parent/nested repository boundaries, branch intent, and any relevant release or E2E decision.

Exit with an implementable scoped plan and explicit approval state. Do not write product code. If the design is materially unresolved, request HLD approval; a direct instruction to implement a clear change already supplies it.
