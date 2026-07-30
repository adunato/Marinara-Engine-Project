# CR018: Scene Daily Memory Snapshot Continuity

Status: Implemented, focused validation passed, and merged into local application `main`

## Goals

- Extend the Conversation-to-Roleplay context captured by `/scene` with the current Daily Conversation Memories retrieval snapshot.
- Select Daily Memories from the same configured last-message query, ranking weights, recency policy, and minimum-rank threshold used by normal Conversation generation.
- Preserve the exact selected Daily Memories in CR013's opaque `conversationContext` handoff so the scene planner and created Roleplay receive identical continuity.
- Keep the captured memories stable for the life of the scene, including scene forks, even if the origin Conversation's memories or retrieval result later change.
- Preserve existing `/scene` behavior when the Daily Memories agent is disabled, unavailable, has no qualifying stored memories, or retrieval fails.

## Current Behavior

CR013 replaced `/scene`'s fixed recent-message excerpts with a summary-rich, read-only Conversation history snapshot. That snapshot includes automatic day/week summary prose, eligible automatic-summary key details, summary tails, older unsummarized history, and the full current logical day.

CR015 added a separate Daily Conversation Memories agent. During normal Conversation generation, it embeds the configured last `N` eligible messages, ranks stored day-scoped memories by semantic similarity, importance, and recency, applies the configured minimum-rank threshold without a fixed result-count cap, and injects the qualifying result grouped by memory date.

The CR013 scene compiler does not query or include CR015 Daily Memories. A `/scene` request can therefore lose durable facts that the immediately preceding normal Conversation generation received, even though its automatic summaries and transcript history are preserved.

## Product Model

The **current Daily Memories snapshot** is the deterministic retrieval result computed when `/scene/plan` captures the origin Conversation context:

1. Use the origin Conversation's enabled Daily Memories configuration.
2. Build the retrieval query from the configured number of last eligible origin messages, using the same visibility and message-role policy as normal Conversation generation.
3. Retrieve already-persisted Daily Memories using the configured semantic, importance, recency, and minimum-rank settings.
4. Preserve every qualifying memory; do not introduce a scene-specific result cap.
5. Format the selected memories chronologically by stored memory date, with their importance values, inside a clearly delimited Daily Memories section of the scene context.
6. Freeze that formatted result into the existing CR013 `conversationContext` capture.

The snapshot is captured context, not a live link. `/scene/create` must persist the exact plan-time value in `sceneConversationContext` and must not independently rerun Daily Memories retrieval when the plan already carries a capture. Existing fallback behavior for older callers that omit the captured context may compile a fresh complete snapshot at create time.

## Proposed Solution

Add a read-only Daily Memories context resolver to the server-side scene compilation path.

The resolver will reuse or extract the existing CR015 helpers for:

- determining whether Daily Memories are enabled for the origin Conversation;
- normalizing its retrieval settings;
- building the query from the configured last-message window;
- resolving the configured embedding source;
- ranking and minimum-threshold filtering; and
- formatting the result by date without changing prompt leaf content.

`POST /scene/plan` will resolve the Daily Memories snapshot before calling the CR013 context formatter. The formatter will accept that optional resolved snapshot and place it in its own structural section, separate from automatic-summary `keyDetails`, summary prose, and transcript history. The existing `SceneFullPlan.conversationContext` string remains the opaque client handoff, so no new client-visible memory payload is required.

The resolver must only read stored memories. It must not call `ensureMissingDailyMemoryDays`, form or regenerate a day, write embeddings, modify agent configuration, or invoke the Daily Memories formation LLM. Query embedding and deterministic retrieval are allowed because they are the same read-only selection work performed for normal prompt assembly.

Daily Memories retrieval remains fail-open. If the agent is disabled, its settings cannot be resolved, no embedding source is available, the query is empty, no memories qualify, or retrieval errors, `/scene` continues with the existing CR013 snapshot and logs a bounded diagnostic without failing scene planning.

## Compatibility and Scope

- No database schema change is expected; CR015's persisted Daily Memory rows remain authoritative.
- No shared scene request/response change is expected because CR013 already transports an opaque context string.
- Existing captured scene contexts remain readable and unchanged.
- Automatic-summary memory inclusion controls from CR017 do not govern Daily Memories; they remain separate prompt sources.
- The character-initiated scene flow can receive the same improvement because it uses the shared scene plan/create routes, while `/scene` remains the acceptance path.

## Out of Scope

- Generating missing Daily Memory days as part of `/scene`.
- Adding a scene-specific Daily Memories toggle, ranking profile, result limit, or editor.
- Including all stored Daily Memories regardless of retrieval relevance.
- Re-querying Daily Memories on each Roleplay turn or after scene creation.
- Copying Daily Memory records into the Roleplay database or visible transcript.
- Changing CR015 formation, editing, preview, embedding, or normal Conversation retrieval behavior.
- Changing automatic summaries, Memory Recall, character memories, scene-conclusion memories, or Roleplay context sources.

## Risks

- Query embedding adds work to `/scene/plan`; provider failure or latency must remain bounded and fail open.
- A separate scene-only ranking implementation could drift from normal Conversation retrieval. Selection and formatting helpers should be shared rather than approximated.
- Daily Memories may overlap or conflict with automatic summaries and transcript history. Clear source delimiters are required, and this CR should not silently deduplicate or rewrite user-maintained memory text.
- Re-running retrieval during `/scene/create` could produce a different result after new messages or memory edits. The captured plan-time string must remain the source of truth.
- Prompt size can increase because CR015 intentionally has no fixed qualifying-result cap. Existing provider context budgeting remains responsible for final request limits; this CR must not restore arbitrary character clipping.
- A runtime resolver coupled to the formation model could omit readable stored memories when only formation configuration is unavailable. Implementation should isolate the retrieval settings and embedding requirements needed for read-only selection.

## Validation

- Verify an enabled origin Conversation with stored Daily Memories captures the same qualifying memory IDs/content as normal CR015 retrieval for the same last-message query and timestamp.
- Cover configured retrieval-message counts, weight normalization, minimum-rank filtering, uncapped qualifying results, chronological date grouping, and importance labels.
- Verify hidden-from-AI and out-of-scope messages do not enter the retrieval query.
- Verify Daily Memories remain separate from automatic-summary key details and are unaffected by CR017's summary-memory inclusion toggle.
- Verify `/scene/plan` receives the enriched snapshot and `/scene/create` persists that exact captured value even if origin messages or Daily Memories change between the two calls.
- Verify older create callers without a captured context receive the same best-effort fresh compilation behavior.
- Verify disabled/unconfigured agents, empty queries, no qualifying rows, missing embedding sources, and retrieval errors leave existing scene context intact and do not block `/scene`.
- Verify scene compilation performs no Daily Memory formation or persistence writes.
- Extend the focused scene-context regression and run a server-only TypeScript check. Decide separately after implementation whether focused Playwright E2E adds useful evidence for the `/scene` acceptance path.

## Validation Result

- Implemented in application commit `afbb2398f` on `change/CR018-scene-daily-memory-context`.
- `pnpm regression:scene-context` passed after extending the CR013 regression with Daily Memories query filtering, chronological formatting, summary-memory separation, verbatim leaf preservation, and read-only settings resolution.
- `pnpm --filter @marinara-engine/server exec tsc --noEmit` passed against the generated shared declarations.
- No client, database schema, dependency manifest, or release metadata changed, so client validation, `pnpm db:push`, and `pnpm version:check` were not applicable.
- The user chose local `main` integration without additional focused Playwright E2E.
- Local application `main` was fast-forwarded to `afbb2398f`.
- A primary-checkout `pnpm build` generated server metadata stamped for `afbb2398f161` and fresh client assets. The top-level command wrapper reached its 120-second limit after writing those artifacts; no build process remained, and the broad build was not repeated under the proportional-validation rule.
