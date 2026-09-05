# CR055 Implementation Plan - Character Briefing Finalization

_Status: Implementation complete; validation handoff pending._

## Scope

Change only the server Character Briefing orchestration and focused regression
coverage, plus CR055 parent bookkeeping. Preserve client, database schema,
provider selection, retry/fallback policy, and unrelated changes.

## Tasks

1. Track completed Daily Memory tool exchanges within a slot's bounded loop.
2. On a tool-free response after an exchange, send one dedicated final
   tools-disabled, non-streaming JSON request and validate only that response.
3. Preserve direct terminal handling before any tool exchange and the existing
   final-round behavior.
4. Add deterministic request-sequence and publication-safety regressions.
5. Run focused regression, server integrity checks, and diff checks.

## Acceptance

- A tool call followed by plain text results in one final structured request;
  the structured replacement is the only value validated/published.
- The final request has no tools, `stream: false`, JSON response format, and
  carries configured reasoning options.
- Invalid/error final responses publish nothing.
- Existing no-tool success behavior remains unchanged.
- The tool loop remains bounded and cannot issue multiple final requests.

## Rollback

Revert the CR055 application commit; no schema or persisted-data migration is
required.
