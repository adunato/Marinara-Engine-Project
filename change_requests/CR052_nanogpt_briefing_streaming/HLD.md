# CR052 — NanoGPT Character Briefing Tool-Round Streaming

Status: Approved implementation

## Goal

Prevent deterministic NanoGPT 503 responses during Character Briefing generation while preserving the existing behavior for every other provider and the final no-tools JSON round.

## Proposed solution

Carry the selected generation connection's provider kind into the resolved agent connection. When Character Briefing supplies its `search_character_daily_memories` tool, set `stream: true` only for the NanoGPT provider. Continue using the existing streamed OpenAI-compatible tool-call assembly and the existing non-streaming path elsewhere.

## Risks

Provider identity must come from the selected connection rather than the wrapped fallback provider. A broad streaming switch could change unrelated providers or structured-output behavior, so the final tool-free round remains non-streaming.

## Validation

Add a focused regression covering NanoGPT case normalization, tool-bearing versus no-tool rounds, and non-NanoGPT behavior. Run the regression and the server TypeScript check.
