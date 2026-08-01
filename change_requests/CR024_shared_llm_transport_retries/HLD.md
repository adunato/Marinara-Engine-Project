# CR024 — Shared LLM Transport Retries

## Status

Completed and fast-forwarded into local application `main` in `7e6743925`.

## Problem

A transient provider transport failure such as `TypeError: fetch failed` currently terminates the calling Marinara workflow immediately. In a multi-step agent operation this discards the live inference context and forces the user to restart work whose earlier tool calls already succeeded.

Phoenix trace `852c088e17735518fdfb8edf79015527` demonstrates the failure during Character Mind mapping: three source-read batches completed, then the next NanoGPT request failed before returning any model response.

This is shared LLM transport behavior, not Character Mind prompt or agent behavior.

## Goal

Add bounded, transparent retry handling at Marinara's shared LLM request boundary so callers preserve their messages, completed tool results, and operation state when an individual provider request fails transiently.

## Proposed direction

- Wrap individual `chatComplete()` requests in a reusable retry mechanism below agent/workflow logic.
- Retry the exact same messages and options; do not restart the agent operation.
- Let configured connection fallback behavior run as part of each attempt.
- Do not consume an agent tool round when no model response was returned.
- Initially allow two retries after the first attempt, with short abort-aware exponential backoff and jitter.
- Retry only errors classified as transient, including network transport failures, connection resets, temporary DNS failures, request timeouts, HTTP 408/429, and HTTP 502/503/504 or equivalent provider overload responses.
- Do not retry authentication, permissions, invalid requests, context-limit failures, safety rejections, or model/tool output validation failures.
- Preserve caller cancellation and stop immediately when its `AbortSignal` is aborted.
- Emit attempt-level observability while recording only the eventual operation outcome in domain logs.

The retry count and delays should remain internal defaults for the initial implementation; this CR does not require new user-facing settings.

## Implemented solution

- Added a shared `LlmTransportRetryProvider` decorator around configured language providers and the local sidecar provider.
- Kept retry outside the complete primary-plus-fallback request so connection fallback runs once per attempt without nested retry multiplication.
- Added two retries with short exponential backoff, jitter, capped `Retry-After`, error/cause-chain classification, and immediate abort propagation.
- Prevented replay after usable streamed output or response callbacks, while preserving the original messages and request options across safe attempts.
- Retained HTTP status and retry timing metadata in provider errors for OpenAI-compatible, Anthropic, Google, and Vertex text requests.
- Kept Phoenix tracing inside the retry decorator so each provider attempt receives its own trace span, while fallback activation is reported once per logical request.

## Non-goals

- Restarting an entire Character Mind Build.
- Correcting malformed model or tool output.
- Redesigning Character Mind page materialization.
- Unlimited retry, job queues, durable workflow recovery, or enterprise-grade orchestration.

## Risks

- A provider may process a request even if Marinara never receives its response, so retry can create bounded duplicate billing.
- Over-broad classification could retry permanent failures and increase latency.
- Retrying above and below connection fallback simultaneously could multiply attempts; the implementation must define one clear retry boundary.

## Validation

- `pnpm regression:providers` passed, including the new deterministic transport retry regression and the existing provider/fallback compatibility suite.
- `pnpm --filter @marinara-engine/server lint` passed (shared/server TypeScript validation).
- The new regression verifies unchanged messages/options and completed tool history, transient/permanent classification, bounded exhaustion with the final cause, capped `Retry-After`, pre-flight/in-flight/backoff aborts, no replay after usable output, and one outer retry loop across connection fallback.
- The single full `pnpm check` attempt reached its four-minute command limit during the client-side phase and was not repeated under the repository's proportional-validation rule.
