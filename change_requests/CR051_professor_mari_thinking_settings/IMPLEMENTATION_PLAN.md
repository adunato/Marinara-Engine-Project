# CR051 Implementation Plan - Professor Mari Connection Thinking Settings

_Status: Approved for implementation._

## 1. Prerequisites

- Use local application `main` as the base and the dedicated worktree/branch
  `change/CR051-professor-mari-thinking-settings`.
- Read the application contribution guidance and any server-specific
  instructions before editing server code.
- Inspect the existing Professor Mari workspace-agent request construction,
  shared connection option resolution, and the closest focused regression
  surface.
- Preserve the primary nested checkout and all unrelated parent/app changes.

## 2. Atomic tasks

1. Locate the Professor Mari `baseChatOptions` or equivalent request-options
   construction and identify the Mari-only reasoning override and its exact
   interaction with `enabledParameters`.
2. Remove only the forced `reasoningEffort: "none"` and forced reasoning
   parameter enablement so the selected connection's resolved settings pass
   through unchanged.
3. Preserve Mari's structured JSON response/tool options and all normal-chat
   option behavior.
4. Add or update a focused regression that exercises Mari request preparation
   with thinking enabled and disabled, asserting that each selected setting is
   preserved and no fixed override is injected.
5. Run the focused regression, `pnpm check`, and `git diff --check`; inspect
   the final diff for unrelated provider, client, database, or generated-file
   changes.

## 3. Expected files and surfaces

- `packages/server/src/services/professor-mari/workspace-agent.service.ts`:
  remove the Mari-specific reasoning override from request construction.
- The existing focused Professor Mari regression or a narrow adjacent server
  regression file, depending on the repository's current test organization.
- No changes planned to `packages/server/src/services/llm/providers/` or the
  generic GLM request compatibility mapper.
- No client, shared schema, database, release, or E2E files are planned.

## 4. Verification

- Confirm the worktree branch is based on local application `main`.
- Verify a thinking-enabled connection reaches Mari without being changed to
  `reasoningEffort: "none"` and without forced reasoning-parameter enablement.
- Verify a thinking-disabled connection remains disabled without an inverse
  force-on behavior.
- Verify structured JSON/tool options are still present and normal chat and
  generic GLM mapping remain untouched.
- Run the focused regression once, then `pnpm check` and `git diff --check`.

## 5. Rollback

Before integration, revert the focused CR051 application commit or retire its
dedicated worktree. Do not reset or overwrite the primary nested checkout.

## 6. Handoff

Implementation, independent review, validation, and local-main integration
remain to be completed on the dedicated CR051 application branch. A provider-
specific GLM-5.3/NanoGPT compatibility fix, if required after this change, is
separate follow-up work.
