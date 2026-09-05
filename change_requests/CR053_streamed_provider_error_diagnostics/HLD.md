# CR053 — Streamed Provider Error Diagnostics

Status: Draft — planning approval required

## Goal

Preserve the provider error payload carried by an OpenAI-compatible streaming
response when a stream terminates with `finish_reason: "error"`, so Phoenix
traces and the Character Briefing failure path expose the actual status, code,
message, request identifier, and retry metadata available from NanoGPT or an
upstream model route. This change is diagnostic only; it must not introduce or
alter retry policy.

## Proposed solution

Extend the Marinara OpenAI-compatible streaming adapter to retain the terminal
SSE error object and relevant response metadata instead of reducing the event
to only `finish_reason: "error"` and an empty completion. Convert the retained
payload into a typed provider error (or an equivalent structured diagnostic)
that the Phoenix integration records on the provider span, with sensitive
request content and credentials excluded. Ensure Character Briefing receives a
real provider failure with the preserved diagnostics rather than an apparently
successful empty assistant result.

The implementation must preserve the distinction between an HTTP failure and
a 200 response whose SSE stream terminates with an embedded error. It must not
classify the event as retryable or change existing fallback/retry decisions;
those decisions remain outside this CR pending a later investigation.

## Risks

- Provider-specific SSE error shapes may be absent, partial, or inconsistent;
  parsing must remain tolerant while retaining unknown fields only when safe.
- Diagnostics can accidentally expose prompts, memory contents, API keys, or
  other provider-sensitive data; logging must use an explicit allowlist.
- Changing an empty completion into a thrown error may affect Phoenix span
  status and Character Briefing UI/error propagation, so existing successful
  streaming tool rounds must remain unchanged.

## Validation

Add focused parser/provider tests for terminal streamed error payloads,
including NanoGPT-style embedded status/code/message data, missing fields, and
ordinary successful tool-call streams. Verify Phoenix receives the structured
diagnostic and Character Briefing does not publish an empty or partial result.
Run the focused regression and proportionate server checks; do not add retry
tests or change retry behavior as part of this CR.
