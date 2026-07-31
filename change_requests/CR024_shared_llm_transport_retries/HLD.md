# CR024 — Shared LLM Transport Retries

## Status

Deferred placeholder. Pick up after the current Character Mind work is complete. No application branch or implementation has been started.

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

- Deterministic tests for retryable and non-retryable failures.
- Verify messages and request options are identical across attempts.
- Verify successful tool history owned by the caller remains intact.
- Verify abort cancels both an in-flight request and backoff.
- Verify exhaustion returns the final useful error with attempt context.
- Run server TypeScript validation and focused provider/runtime regressions.
