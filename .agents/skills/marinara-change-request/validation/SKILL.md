---
name: marinara-change-request-validation
description: Run proportionate validation for completed Marinara Engine CR work and report exact evidence.
---

# Marinara CR Validation

Read the [shared contract](../SHARED_CONTRACT.md), approved acceptance expectations, and implementation handoff. Run the smallest validation that can catch a plausible failure: `pnpm check` for substantive or cross-cutting changes, `pnpm db:push` for relevant schema work, and `pnpm version:check` for version/release metadata. Use focused regressions or agreed E2E only when they prove the changed behavior.

Record exact commands and results. Stop every launched server and verify its port is closed before handoff. Report non-trivial failures for diagnosis; do not diagnose or fix them in this stage.
