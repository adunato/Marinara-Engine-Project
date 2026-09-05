# CR054 - Character Briefing Connection Reasoning Settings

_Status: Implemented; validation handoff pending._

## Goal

Make Character Briefing honor the selected language connection's persisted
reasoning/thinking setting for every model request in its sequential briefing
chain.

## Finding

Character Briefing resolved the selected connection's provider, model, and
fallback wrapper, but constructed each `ChatOptions` object without the
connection's stored root `reasoningEffort`. The connection-default wrapper only
binds `customParameters`; it does not translate the persisted reasoning setting
into runtime options. GLM compatibility therefore received no active runtime
reasoning effort and serialized `enable_thinking: false`, which NanoGPT rejected
for GLM 5.3.

## Solution

Resolve the selected connection's stored chat options using the existing
provider/model-aware resolver, retain its resolved `reasoningEffort` on the
formation connection, and include that optional value in a shared Character
Briefing round-options builder. The builder is used for both tool-bearing rounds
and the final structured-output round. When no setting is persisted, the field
is omitted and current behavior is preserved.

No retry, fallback, provider routing, prompt, tool, schema, database, or client
behavior changes are included.

## Validation

- Focused Character Briefing reasoning-settings regression.
- GLM compatibility assertion that active effort enables thinking for NanoGPT.
- Server TypeScript/lint check and `git diff --check`.
