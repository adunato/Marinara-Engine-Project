# CR053 Implementation Plan - Streamed Provider Error Diagnostics

_Status: Planning; implementation approval pending._

## 1. Prerequisites

- CR052 NanoGPT Character Briefing tool-round streaming is present on local
  application `main`.
- Confirm the current OpenAI-compatible stream parser, typed provider-error
  conventions, Phoenix provider tracing wrapper, and Character Briefing error
  propagation path before editing.
- Create the dedicated nested application worktree/branch
  `change/CR053-streamed-provider-error-diagnostics` only after explicit
  implementation approval.
- Keep the primary nested checkout, parent planning records, credentials, and
  existing unrelated work untouched.
- No retry, fallback, request-shape, schema, dependency, database, release, or
  E2E expansion is approved by this plan.

## 2. Atomic ordered tasks

1. **Define the diagnostic contract.** Identify or add the shared typed error
   shape with `kind`, bounded sanitized `status`, `code`, `message`,
   `requestId`, and `retryAfter`. Keep the stream/HTTP distinction explicit
   and do not add a retryable flag or inferred retry status.
2. **Extract streamed error payloads.** Update the OpenAI-compatible SSE
   parser/adapter to inspect `finish_reason: "error"`, top-level `error`
   objects, and no-choices error frames. Read only `X-Request-ID` and
   `Retry-After`, sanitize/bound the six fields, and discard all other fields.
3. **Surface the provider failure.** If the terminal error arrives before any
   content or tool call has accumulated, throw the typed error. Preserve the
   existing partial-output behavior when content/tool-call data already
   exists, and leave all retry/fallback classification unchanged.
4. **Record Phoenix diagnostics.** Extend the Phoenix provider integration to
   capture the typed exception and only the allowlisted scalar attributes. Do
   not record raw frames, bodies, prompts, tools, credentials, or arbitrary
   headers/fields.
5. **Verify Character Briefing propagation.** Ensure a failed tool-bearing
   briefing round reaches the existing error path as a provider failure and
   cannot be converted into an empty replacement or published partial result.
6. **Add focused regression coverage.** Cover representative NanoGPT error
   frames, no-choices frames, missing/malformed fields, header extraction,
   successful streamed tool calls, partial-output preservation, Phoenix
   mapping, and Character Briefing publication safety.
7. **Run proportionate verification.** Execute the focused server regression,
   the repository-equivalent server type/lint check, and `git diff --check`;
   inspect the final diff for scope and accidental sensitive/generated data.

## 3. Expected files and responsibility

Confirm exact paths against the approved application base before editing. The
expected surfaces are:

- OpenAI-compatible streaming parser/provider implementation and its typed
  provider-error definitions.
- Phoenix provider tracing/error-normalization adapter.
- Character Briefing error propagation/publication guard only if the existing
  path cannot already carry the typed error safely.
- Focused server/provider/Phoenix/Character Briefing regression fixtures or
  scripts following the repository's established test pattern.

No parent tracker files, client code, database/schema files, retry-policy
modules, model routing, request construction, or release metadata are part of
the application implementation surface.

## 4. Verification matrix

| Area | Required evidence |
| --- | --- |
| Extraction | Terminal choice error, top-level error, and no-choices error frames produce the bounded six-field diagnostic; missing fields remain safe. |
| Headers | Only `X-Request-ID` and `Retry-After` are considered, with scalar bounds and no arbitrary-header leakage. |
| Provider | Empty terminal error throws the typed stream error; ordinary success remains unchanged; partial accumulated output retains existing behavior. |
| Phoenix | Failed span records the typed exception and only allowlisted scalar diagnostic attributes. |
| Character Briefing | The error is surfaced as a provider failure and no empty/partial replacement is published. |
| Scope | No retry/backoff/fallback behavior changes; `git diff --check` and focused server checks pass. |

Do not require a live NanoGPT failure to prove parsing; deterministic SSE
fixtures must exercise the payload shapes. No E2E test is planned unless the
user separately agrees that the focused Character Briefing behavior warrants
one.

## 5. Rollback

Revert the focused application commit or retire the dedicated CR worktree
before integration. No migration, persisted-data conversion, configuration
rollback, or remote operation is needed. Rollback must restore the prior
normalization/propagation behavior without changing unrelated retry policy.

## 6. Handoff and approval

The plan is atomic and implementation-ready, but implementation remains
blocked pending explicit user approval. After approval, the implementation,
review, validation, and ship stages must use their dedicated CR workflow and
must not broaden the diagnostic allowlist or introduce retry policy under this
CR.
