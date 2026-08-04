# CR023 — Character Mind Plan Recovery

## Problem

The corpus planner can recover from failed or incomplete Markdown reads while it is still calling tools, but CR022 validates corpus coverage only after the planner returns its final JSON. A premature final answer therefore ends the operation even when the remaining planner round budget could correct it.

Phoenix trace `4ca29a157a16956a914d874fa0c56c55` demonstrated the failure: a 13-file `mind_read_markdown` batch exceeded the 12-file tool limit and included one mistyped path. The failed batch contributed no reads. The planner then returned a page map after reading only the second batch, and Marinara correctly rejected it because `SCHEMA.md`, `index.md`, and multiple raw sources had not been read.

## Outcome

Keep CR022's two-pass design and strict corpus requirements. Make final-plan validation a recoverable checkpoint inside the existing planner loop:

1. When the planner proposes a final map, Marinara checks that `SCHEMA.md`, `index.md`, and every manifest source were successfully read.
2. If reads are missing, Marinara rejects the candidate inside the same agent run and supplies the exact unread paths.
3. The planner continues using the existing Markdown read tool and remaining round budget, then submits a complete replacement map.
4. Invalid page-map structure receives the same corrective continuation.
5. If the planner still cannot produce a valid map within its budget, Build fails without accepting or materializing a partial map.

This does not enlarge source pages, weaken validation, silently omit sources, or change the 12-file read limit. The prompt will state the batching limit and require exact manifest paths so the planner can arrange valid calls from the outset.

## Scope

- Character Mind `plan` operation orchestration and prompt guidance.
- Focused regression coverage for an incomplete plan followed by corrective reads and a valid replacement plan.
- No UI, schema, source-generation, page-map, or materialization changes.

## Acceptance criteria

- A premature plan with unread corpus files is not terminal while planner rounds remain.
- Corrective feedback identifies every exact unread path and the read batch limit.
- A corrected plan can complete in the same Character Mind operation.
- Strict post-operation validation remains as defense in depth.
- A planner that never corrects itself still fails without creating wiki pages.
