# CR053 - Streamed Provider Error Diagnostics

_Status: Proposed; planning complete, implementation approval pending._

## 1. Goal

Preserve enough safe provider diagnostics to explain an OpenAI-compatible
stream that starts successfully but terminates with `finish_reason: "error"`.
The primary investigation target is the NanoGPT connection routing the GLM
model used by Character Briefing. The diagnostics must reach Phoenix and the
briefing failure path without exposing prompts, tool data, credentials, or
arbitrary provider payloads.

This CR is observability-only. It does not add or change retry, backoff,
fallback, model-selection, or request-shaping policy.

## 2. Current failure boundary

The provider can return HTTP 200 and then encode a failure in the streamed
SSE response. Marinara currently reduces that event to an empty normalized
completion with `finishReason: "error"`, which hides the provider's status,
code, message, and request metadata from Phoenix and leaves Character Briefing
with a misleading empty result.

The design must preserve the distinction between:

- an HTTP response failure before streaming starts; and
- an HTTP 200 response whose stream contains an embedded terminal error.

## 3. Proposed solution

### 3.1 Shared streamed-error extraction

Add one shared, tolerant extractor in the OpenAI-compatible streaming parsing
surface. It must recognize all of the following equivalent failure shapes:

- a normal streamed choice whose finish reason is `"error"` and whose event
  carries a top-level `error` object;
- a no-choices error frame carrying a top-level `error` object; and
- a terminal error frame where provider-specific fields are nested beneath
  the stream event but are still represented by the OpenAI-compatible error
  shape.

The extractor returns only this typed diagnostic contract (all fields
optional except the discriminator):

```ts
{
  kind: "stream_terminated_error";
  status?: number;
  code?: string;
  message?: string;
  requestId?: string;
  retryAfter?: string;
}
```

`status` is bounded to a valid HTTP status range. `code`, `message`,
`requestId`, and `retryAfter` are bounded/sanitized scalar strings. Unknown
provider fields are discarded. The only response headers read for this
diagnostic are `X-Request-ID` and `Retry-After`; no arbitrary headers are
copied into the error or trace.

### 3.2 Provider behavior

When the stream terminates with an error and no assistant content or tool call
has been accumulated, the OpenAI-compatible provider throws a typed provider
error containing the sanitized diagnostic. Phoenix can then mark the span as
failed and record the cause. Existing partial-output behavior is preserved:
if content or a tool call has already been accumulated, the provider does not
discard that output or change its current completion semantics solely because
the terminal event is unusual.

The typed error must retain the HTTP/stream distinction and must not be mapped
to HTTP 503 or any other retryable status merely because the stream error may
be transient. Existing retry and fallback classification remains unchanged
until a later CR explicitly investigates and authorizes a policy change.

### 3.3 Phoenix recording

Extend the Phoenix provider error recording to attach only allowlisted scalar
diagnostic attributes (`kind`, `status`, `code`, `message`, `requestId`, and
`retryAfter`) and the typed exception. Do not attach raw SSE frames, request or
response bodies, prompts, memory contents, tool arguments/results, API keys,
authorization headers, or arbitrary provider fields.

Character Briefing should receive the typed provider failure through its
existing error propagation path. This prevents the stream error from being
reported later as an empty replacement and does not publish an empty or
partial briefing.

## 4. Invariants and excluded scope

- No retry, backoff, delay, retryability, fallback, or error-code policy
  changes.
- No model, provider routing, request payload, stream choice, tool schema, or
  Character Briefing prompt changes.
- No Phoenix raw-stream capture or arbitrary payload logging.
- No database, persistence, schema, client, dependency, release, or E2E
  behavior changes beyond focused diagnostic regression coverage.
- Successful streamed tool calls remain byte/behavior compatible.
- Partial streamed output retains its current handling.
- Diagnostics are bounded, sanitized, and safe to display in Phoenix.

## 5. Risks and mitigations

- **Provider shape variance:** use a tolerant shared extractor and fixtures for
  top-level and no-choice error frames, while ignoring unknown fields.
- **Sensitive-data leakage:** construct the diagnostic from an explicit field
  and header allowlist with scalar bounds; never retain raw frames.
- **Behavior regression:** throw only for an error with no accumulated content
  or tool call; preserve successful and partial-output paths.
- **Misleading recovery semantics:** retain the stream-specific kind and do not
  infer retryability from an embedded status.
- **Tracing mismatch:** test both exception capture and scalar Phoenix
  attributes, including missing/partial payload fields.

## 6. Validation

Add focused parser/provider tests for:

- NanoGPT-style `finish_reason: "error"` with top-level status, code, and
  message;
- no-choices error frames;
- response-header request ID and retry metadata;
- missing or malformed fields and bounded sanitization;
- ordinary successful streamed tool calls; and
- an error after accumulated content/tool-call data, proving existing partial
  output behavior is retained.

Add Phoenix mapping coverage proving only the six allowlisted diagnostic
attributes and the exception are recorded. Add a Character Briefing
regression proving a failed stream is surfaced as a provider error and cannot
publish an empty or partial replacement.

Run the focused server regressions/checks and `git diff --check`. Do not add
retry tests or change retry behavior as part of CR053.

## 7. Approval state

The diagnostic contract and implementation boundaries are sufficiently
specified for a later implementation stage. This CR remains in Planning until
the user explicitly approves implementation; no application worktree or
product-code change is authorized by this document.
