# CR053 Implementation Plan — Streamed Provider Error Diagnostics

## Prerequisites

- CR052 NanoGPT Character Briefing tool-round streaming is present on local
  application `main`.
- The current OpenAI-compatible streaming adapter and Phoenix provider tracing
  path are identified and their existing success/error contracts are captured.
- No retry, fallback, schema, dependency, or database change is approved by
  this CR.

## Atomic tasks

1. Define the sanitized structured diagnostic contract for a streamed provider
   error, including optional status, provider code, message, request ID, retry
   metadata, and stream/HTTP distinction.
2. Update the OpenAI-compatible SSE parser/adapter to preserve that allowlisted
   payload when `finish_reason: "error"` occurs and surface it as a provider
   failure without changing retry classification.
3. Update Phoenix integration/error recording so the structured diagnostic is
   attached to the relevant span and the span is marked failed, while keeping
   prompts, tool arguments/results, credentials, and arbitrary provider fields
   out of the trace.
4. Verify Character Briefing propagates the diagnostic and does not treat the
   failed stream as an empty replacement or publish partial output.
5. Add focused regression coverage for the parser, Phoenix mapping, successful
   streamed tool calls, and incomplete/malformed error payloads; inspect the
   diff and run proportionate server validation.

## Files affected

Expected application surfaces (confirm during planning after code inspection):

- OpenAI-compatible streaming provider/parser implementation.
- Phoenix provider tracing/error normalization adapter.
- Character Briefing error propagation and/or focused regression harness.
- Tests or regression scripts covering streamed provider error diagnostics.

No parent tracker or application retry-policy files should be changed beyond
the CR documentation required to record the design.

## Verification

- Focused streamed-error parser/provider regression with representative SSE
  fixtures.
- Phoenix trace assertion for allowlisted diagnostic fields and failed span
  status.
- Character Briefing regression proving no empty/partial result is published.
- `pnpm --filter @marinara-engine/server lint` (or the repository-equivalent
  focused server check) and `git diff --check`.

## Rollback

Revert the application commit. No migration or persisted-data rollback is
needed. Retry and fallback behavior must remain identical before and after the
change.
