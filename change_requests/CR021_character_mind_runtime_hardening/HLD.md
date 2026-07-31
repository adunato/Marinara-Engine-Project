# CR021 — Character Mind Runtime Hardening

Status: merged into local `main`

## Problem

A real Character Mind build trace showed Mistral successfully reading the required files, then repeatedly calling an invented `wiki_write` function. The runtime rejected those calls but ultimately logged only the secondary error that the final JSON lacked `summary`. The operation therefore failed without applying the generated wiki pages, and its log obscured the actionable cause.

## Goals

- Make the exact write tools and terminal JSON contracts unambiguous to the agent.
- Give the agent enough information to correct an invented or unavailable tool call on its next round.
- Prevent an unresolved mutation failure from being reported as success or hidden behind a terminal-format error.
- Keep the implementation provider-neutral and small; do not add aliases for model-invented tool names.

## Solution

- State the exact ingest, query, and lint result objects in both the generated schema and operation prompts, explicitly forbidding wrapper keys and Markdown fences.
- Name the exact ingest write functions and argument keys in the ingest prompt.
- Include the permitted tool names when a model calls an unavailable tool.
- Track failed wiki and index mutations independently. A later successful mutation of the same target clears its failure; otherwise the operation fails with the actual rejected mutation.
- Preserve the last tool error when terminal result parsing or validation also fails.

## Risks

- More prescriptive prompts slightly reduce model latitude, but only at the tool and result protocol boundary.
- Existing Character Mind folders retain their original `SCHEMA.md`; the runtime prompt carries the same complete contract, while newly initialized folders receive the hardened schema.

## Validation

- Focused Character Mind regression, including exact prompt contracts and actionable rejection of `wiki_write`.
- Server TypeScript validation.
- Integrated production build from the primary checkout.

