# CR027 Implementation Plan

## Prerequisites

- Phoenix LLM tracing is enabled locally.
- CR026 streams Character Mind page sessions.

## Tasks

1. Extend the internal provider options with a raw-stream chunk callback.
2. Emit decoded response chunks before parsing in OpenAI Chat Completions and Responses API streaming paths.
3. Capture and summarize the stream in the Phoenix tracing decorator, including the exact response body.
4. Add deterministic regression coverage for raw SSE capture without contacting an external provider.
5. Run focused validation, commit, merge into local application `main`, and rebuild.

## Files Affected

- `packages/server/src/services/llm/base-provider.ts`
- `packages/server/src/services/llm/providers/openai.provider.ts`
- `packages/server/src/services/llm/phoenix-tracing-provider.ts`
- `scripts/regressions/provider-compat.regression.ts`

## Rollback

Revert the CR027 application commit. Streaming behavior remains available through CR026 but Phoenix will again show only the final parsed completion.

## Completion

Implemented in application commit `a9432755a` and fast-forwarded into local application `main` on 2026-08-01.
