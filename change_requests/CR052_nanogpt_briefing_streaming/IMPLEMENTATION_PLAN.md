# CR052 Implementation Plan — NanoGPT Character Briefing Tool-Round Streaming

## Prerequisites

- CR044 Character Briefing is present on the current application `main`.
- The existing OpenAI-compatible provider already assembles streamed tool calls.
- No schema, client, dependency, or external-provider changes are required.

## Atomic tasks

1. Preserve the selected connection provider kind when resolving the Character Briefing generation connection.
2. Add a narrow provider-kind predicate and use it only for tool-bearing briefing rounds.
3. Keep the stream decision provider-attempt-specific when the selected connection's fallback wrapper switches providers.
4. Add a focused regression for NanoGPT, non-NanoGPT, and final no-tools behavior.
5. Run the focused regression, server TypeScript check, inspect the diff, and commit the application worktree.

## Files affected

- `packages/server/src/services/character-daily-memories/formation.service.ts`
- `packages/server/src/services/character-briefing.service.ts`
- `packages/server/src/services/llm/connection-fallback-provider.ts`
- `scripts/regressions/character-briefing-nanogpt-streaming.regression.ts`

## Verification

`pnpm build:shared && node ./scripts/run-regressions.mjs --filter character-briefing-nanogpt-streaming` and `pnpm --filter @marinara-engine/server lint`.

## Rollback

Revert the application commit. No migration or persisted-data rollback is needed.
