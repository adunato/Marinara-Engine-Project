# CR026: Character Mind Page Streaming

## Status

Implemented and merged into local application `main`.

## Goal

Prevent long Character Mind page materialization from waiting for a complete buffered tool call before Marinara receives provider output.

## Proposed Solution

Enable streaming for `build-page` Character Mind sessions only. The existing provider streaming path will accumulate text and tool-call deltas into the same `ChatCompletionResult` contract used by the runtime, after which the existing tool validation and page-write logic continues unchanged.

Planning, incremental ingest, query, lint, source selection, page schema, and timeout policy remain out of scope.

## Risks

- OpenAI-compatible providers may encode streamed tool-call deltas differently. Marinara's shared provider already normalizes the supported variants; focused regression coverage will ensure Character Mind requests the streaming path.
- Streaming exposes progress to the transport but does not yet add user-visible token progress or change the five-minute page-session deadline.

## Validation

- Run the focused Character Mind regression.
- Run server TypeScript validation.
