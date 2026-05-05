---
name: marinara-e2e-validation
description: Create, organize, run, and review Marinara-Engine Playwright end-to-end validation for completed change requests. Use when Codex needs to add CR-specific E2E tests, reusable Playwright macros, page objects, deterministic fake-provider scenarios, reviewer evidence, test naming conventions, annotations, or server-log-backed validation.
---

# Marinara E2E Validation

Use this skill only in `Marinara-Engine-Project/`. The Playwright harness lives in the parent repo and starts the nested `Marinara-Engine/` app.

## Scope

- Use the existing parent Playwright harness under `tests/e2e`.
- Keep CR-specific specs under `tests/e2e/specs/change-requests/CRXXX/`.
- Put reusable scenario operations in `tests/e2e/macros/`.
- Put UI navigation/assertion wrappers in `tests/e2e/pages/`.
- Put shared runtime fixtures or deterministic providers in `tests/e2e/fixtures/`.
- Do not create files or folders outside `Marinara-Engine-Project/`.

## Before Adding Tests

1. Confirm the target CR branch and CR number.
2. Agree the focused E2E scenarios with the user after implementation work is complete.
3. Do not add broad regression coverage unless the user explicitly asks for it.
4. Prefer deterministic fake providers over real LLM calls while preserving the app's normal server, SSE, tool, agent, and persistence paths.

## Naming

- Prefix backend/API-driven tests with `[api]`.
- Prefix browser-interaction tests with `[ui]`.
- Use a verb phrase that states the behavior and the observable outcome, for example:
  - `[api] persists a summary update to chat metadata`
  - `[ui] refreshes the summary UI when a custom memory agent updates metadata`

## Reusable Steps

- Wrap each reusable macro body in `test.step()` with reviewer-readable names.
- Name setup steps by the operation they perform, such as `Seed deterministic fake provider connection`.
- Name assertion steps by the evidence being checked, such as `Assert generation returned exactly one tool_result event`.
- Keep macros composable and scenario-level. Avoid hiding the central assertion in an opaque helper name.

## Evidence

- Use `test.info().annotations.push({ type: "evidence", description: "..." })` for reviewer-facing comments that explain what a step proves.
- Attach structured evidence with `test.info().attach(...)`, especially:
  - parsed SSE events
  - tool result payloads
  - metadata snapshots
  - token streams
  - filtered server log snippets
- UI tests should produce screenshots or traces when practical, especially for visual state changes.
- API tests do not need screenshots by default; attach JSON and log evidence instead.
- Keep server, client, and shared-build logs available through `test-results/e2e/logs`.

## Validation

- Run `cd Marinara-Engine && pnpm check` as baseline app validation.
- Run focused CR E2E specs with `pnpm exec playwright test tests/e2e/specs/change-requests/CRXXX`.
- Run `pnpm e2e` only when the branch is expected to pass the full local E2E suite.
- Use `pnpm e2e:ui` or `pnpm exec playwright test --headed --debug <spec>` for visual inspection.
- Commit completed E2E changes before handing work back to the user.
- Remove temporary worktrees after a successful commit and clean status unless the user explicitly asks to keep them.
