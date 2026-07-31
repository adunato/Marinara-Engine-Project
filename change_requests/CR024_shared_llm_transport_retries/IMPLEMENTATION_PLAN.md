# CR024 — Implementation Plan

## Status

Deferred placeholder. Refine and approve this plan when CR024 is picked up.

## 1. Locate the retry boundary

- Review the shared provider registry, connection fallback wrapper, and `BaseLLMProvider` request paths.
- Place retry outside the complete fallback-aware request attempt but below agents and feature workflows.
- Confirm that streaming and non-streaming paths require the same or separate treatment; keep the initial implementation to safely retryable requests that have returned no usable response.

## 2. Add shared retry policy

- Implement transient-error classification across the error/cause chain and typed HTTP/provider failures.
- Implement abort-aware backoff with two retries after the initial request.
- Preserve the original messages, options, tools, and signal on every attempt.
- Never count transport retries as agent tool rounds.
- Surface a clear exhausted-attempt error without hiding the original cause.

## 3. Observability

- Add structured warning logs for retry number, delay, provider/connection context where safely available, and classified cause.
- Ensure Phoenix records the individual attempts without duplicating feature-domain success/failure entries.

## 4. Tests

- Succeeds immediately without delay.
- Retries a transient failure and succeeds with identical input.
- Stops after the configured maximum.
- Does not retry permanent request errors.
- Respects `Retry-After` where available within a safe bound.
- Aborts during both request execution and backoff.
- Does not duplicate already-completed caller tool operations.

## 5. Validation and handoff

- Run focused shared-provider/server regressions.
- Run server TypeScript validation.
- Use broader validation only if the final implementation changes shared streaming or all generation paths.
- Decide separately whether any UI-level E2E is useful; none is expected for a server-only transparent retry change.
