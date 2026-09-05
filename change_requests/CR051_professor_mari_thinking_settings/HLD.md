# CR051 - Professor Mari Connection Thinking Settings

_Status: Planning; approved for implementation by direct user request._

## 1. Purpose

Make Professor Mari honor the selected LLM connection's configured thinking
and reasoning settings instead of forcing thinking off for every request. This
allows Mari to use connections whose provider requires thinking to be enabled
or rejects an explicit `enable_thinking: false` value, while preserving the
connection-specific behavior already used by normal chat.

## 2. Goals

- Remove Mari's hardcoded thinking/reasoning override from the request options
  assembled for her workspace agent.
- Pass through the selected connection's configured reasoning value and
  enabled-parameter behavior exactly as normal chat does.
- Preserve Mari's structured JSON command protocol, system prompts, tool
  handling, and all unrelated chat behavior.
- Keep generic GLM request compatibility unchanged; provider-specific payload
  mapping remains responsible for translating the selected settings.
- Add focused regression coverage proving that Mari no longer injects a
  forced `reasoningEffort: "none"` or forced reasoning parameter enablement.

## 3. Non-goals

- Do not change the generic GLM request mapper or add model-specific NanoGPT
  handling in this CR.
- Do not redesign Professor Mari's prompts, tool schema, command parser, or
  workspace-agent lifecycle.
- Do not change how normal chat stores or resolves connection settings.
- Do not force thinking on or off globally; the selected connection remains
  the source of truth.
- Do not add a database migration, new persisted setting, release metadata, or
  provider dependency.

## 4. Base and branch intent

- Application base: local application `main`.
- Planned application branch: `change/CR051-professor-mari-thinking-settings`.
- Parent CR documentation remains in this repository; implementation must use
  a dedicated nested application worktree.

## 5. Proposed solution

In the Professor Mari workspace-agent request construction, retain the base
chat options needed for structured JSON/tool execution but stop overwriting
the selected connection's reasoning configuration. Specifically, remove the
Mari-only values that set reasoning effort to `none` and explicitly mark the
reasoning parameter as enabled. The existing connection-resolution and shared
request-option path will then carry the configured reasoning value and
`enabledParameters` state into the provider request.

The implementation should keep any unrelated Mari-specific option, such as
response format or structured-command constraints, intact. A focused test
should inspect the resulting options or provider call for both a thinking-
enabled connection and a thinking-disabled connection, verifying that Mari
does not replace either value with a fixed setting. Normal chat and the GLM
compatibility mapper should remain covered by their existing tests.

## 6. Invariants and boundaries

- The selected connection's reasoning configuration is unchanged between
  normal chat and Professor Mari request preparation.
- Mari does not add `reasoningEffort: "none"` or force the reasoning parameter
  into `enabledParameters`.
- Mari's structured JSON command behavior remains unchanged apart from the
  model's ability to use the selected thinking setting.
- No provider mapper receives a new or altered contract from this CR.
- Only the dedicated CR worktree may contain application edits; the primary
  nested checkout remains coordination-only.

## 7. Risks and mitigations

- **Thinking-enabled models may emit less directly parseable command output.**
  Preserve the existing structured-output options and add focused regression
  coverage for option propagation; any provider-specific response-format issue
  remains separate follow-up work.
- **A broad cleanup could alter normal chat or provider mapping.** Keep the
  diff limited to the Mari override and its focused regression surface.
- **A provider may reject the selected setting for its own reasons.** Report
  such failures as provider compatibility issues rather than reintroducing a
  global Mari override.

## 8. Validation expectations

- Run the focused Professor Mari regression covering thinking-enabled and
  thinking-disabled connection settings and absence of the hardcoded override.
- Run the proportionate application integrity check (`pnpm check`) because the
  change affects server request construction and behavior.
- Run `git diff --check` and inspect the final diff for unrelated files.
- No database, release-version, or broad E2E validation is expected from this
  narrow server behavior change; a focused E2E can be considered separately if
  implementation exposes a suitable stable surface.

## 9. Rollback

Revert the focused CR051 application commit. No database or persisted user
data changes are introduced.

## 10. Approval state

The requested behavior is sufficiently defined and directly authorized for
implementation. This CR is registered as standalone and is ready for the
implementation worker on its dedicated worktree.
