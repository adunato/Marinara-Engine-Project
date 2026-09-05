# CR054 Implementation Plan - Character Briefing Connection Reasoning Settings

_Status: Implemented; validation handoff pending._

## Scope

Update only the server-side Character Briefing connection resolution and round
request construction, plus deterministic regression coverage. Keep the primary
nested checkout, client, database schema, retry/fallback policy, remotes, and
unrelated parent changes untouched.

## Tasks

1. Resolve the selected connection's persisted `reasoningEffort` through the
   existing provider/model-aware stored-options resolver.
2. Carry the optional resolved effort through the formation connection.
3. Apply it to every Character Briefing request while preserving existing
   stream, tool, and response-format choices.
4. Cover active, unset, and provider-compatibility behavior with a focused
   regression.
5. Run the focused regression, server TypeScript/lint check, and diff check.

## Acceptance

- A configured `reasoningEffort: "high"` reaches both tool and final briefing
  `ChatOptions`.
- An omitted effort remains omitted.
- Existing briefing stream/tool/JSON request shape is unchanged.
- NanoGPT GLM compatibility receives an active effort and emits
  `enable_thinking: true`.
- No retry or fallback policy is introduced.
