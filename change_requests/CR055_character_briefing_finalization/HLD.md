# CR055 - Character Briefing Finalization

_Status: Implementation complete; validation handoff pending._

## Goal

Ensure Character Briefing never treats an ordinary text response after a Daily
Memory tool exchange as the saved briefing replacement.

## Finding

The briefing service allows up to three tool-bearing rounds followed by a
tools-disabled JSON round. When the model returns no tool call after a tool
exchange, the service currently parses that response immediately. A plain-text
`stop` response therefore reaches replacement validation, producing an
invalid-replacement error without sending the dedicated final JSON request.

## Solution

Track whether a tool exchange has completed. If a later tool-enabled round
returns without tool calls, issue exactly one final tools-disabled,
non-streaming JSON request using the existing round-options builder, then parse
only that response as the replacement. Preserve the existing bounded tool
loop, provider-specific streaming policy, reasoning settings, and atomic
publication behavior. A tool-free response before any tool exchange retains
the existing direct terminal behavior.

## Validation

- Focused Character Briefing orchestration regression covering tool call,
  plain-text stop, and final structured JSON.
- Request metadata assertions for the final no-tools JSON round and reasoning
  options.
- Invalid final response and no-tool success safeguards.
- Server typecheck/lint and diff checks.
