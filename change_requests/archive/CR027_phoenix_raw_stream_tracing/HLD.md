# CR027: Phoenix Raw Stream Tracing

## Status

Implemented and merged into local application `main` in `a9432755a`.

## Goal

Make the exact streamed response body received from OpenAI-compatible providers visible in the existing Phoenix LLM span so Character Mind streaming failures can be diagnosed from evidence rather than inferred from the final parsed result.

## Proposed Solution

- Add an internal `ChatOptions` callback for decoded raw network chunks.
- Invoke it from every OpenAI-provider streaming response reader before SSE parsing.
- When Phoenix tracing is enabled, concatenate those chunks and attach the response body to the LLM span as `llm.stream.raw_response`.
- Add stream measurements for network chunks, raw size, first-chunk latency, SSE data events, malformed events, tool-call deltas, tool-argument characters, content characters, `[DONE]`, and provider finish reason.
- Retain up to 4 MiB per span and explicitly mark truncation. The existing provider response limit remains 50 MiB.

This is tracing only. It does not change model prompts, page length, parsing, retry policy, or Character Mind validation.

## Data Sensitivity

Raw stream tracing contains complete model output and may contain character, memory, or user-authored content. It is emitted only when the existing opt-in Phoenix LLM tracing wrapper is active. It is not written to ordinary server logs.

## Validation

- Extend the provider compatibility regression with deterministic SSE capture assertions.
- Run provider regressions and server TypeScript validation.
- Build the integrated primary checkout.

Completed:

- `pnpm regression:providers`
- `pnpm --filter @marinara-engine/server lint`
- `pnpm build` in the integrated primary checkout
