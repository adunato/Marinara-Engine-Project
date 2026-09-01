# CR042: Character Daily Memories

Status: Approved for implementation

Implementation base: current Pasta-Devs `main` at `1a299369ac7025028c3ce1b80cc59f47b7b0691b` after the clean upstream mirror is aligned.

Conceptual predecessor: archived CR015 Daily Conversation Memories. CR042 is a clean reimplementation from current upstream, not a continuation of the archived CR015 application branch.

## Goals

- Reimplement the useful CR015 daily-memory lifecycle on the current Pasta-Devs upstream codebase.
- Change memory ownership from a Conversation to a character card so a character carries durable memories across all of its Conversation-mode chats.
- For each completed memory day, discover every eligible Conversation in which the character participates and extract memories from one source Conversation at a time.
- Preserve CR015's editable, importance-scored, embedded memories and low-latency retrieval behavior, but retrieve from the character's memory pool rather than the current Conversation's pool.
- Move configuration, review, generation, regeneration, and maintenance UI from Conversation scope to character scope.
- Replace opportunistic formation with reliable server scheduling: run at the configured daily handover time and automatically catch up completed windows that were missed while the server was offline.

## Scope

CR042 applies to **Conversation mode** only. Roleplay and Game chats are outside this change, matching CR015's original Conversation-mode scope.

A qualifying source Conversation is a Conversation-mode chat whose `characterIds` contains the target character and which has eligible transcript messages inside the completed memory window. Multi-character Conversations qualify independently for each participating character.

The feature is character-owned. It is not enabled by adding an agent to individual Conversations, because per-Conversation activation would be inconsistent with a memory pool intentionally shared across all Conversations for the same character.

## Character-Level Configuration

Each character can independently enable Daily Memories and configure:

- Daily handover time as a local `HH:mm` time.
- Memory-formation LLM connection/model selection using the existing connection infrastructure.
- A visible, editable formation prompt with a built-in default and reset-to-default behavior.
- The number of recent messages from the current Conversation used to build the retrieval query.
- Semantic-similarity, importance, and recency ranking weights.
- The minimum retrieval rank percentage.

The effective timezone is the existing Conversation timezone used by Marinara's Conversation chronology; CR042 does not introduce a separate timezone per character.

CR015 retrieval defaults are retained unless implementation analysis identifies an upstream constraint: 50% semantic similarity, 35% importance, 15% recency, approximately 30-day recency half-life, and a 30% minimum-rank threshold. Relative weights are normalized before scoring.

The default formation prompt retains CR015's intent: return up to ten nuanced short-paragraph memories when warranted, fewer when appropriate, with an importance score from 1 through 5. Count and verbosity remain prompt-controlled rather than separate hard limits.

## Memory Day and Timing Model

A character memory day is the exact 24-hour window ending at that character's configured handover time in the effective Conversation timezone.

For example, with a 04:00 handover, the run due at 04:00 processes the completed window ending at that instant and never the new incomplete window that has just begun.

The server assigns the completed window's logical date to the memories. Historical records keep their assigned date/window identity even if the user later changes the handover time or timezone.

Day-boundary logic must remain deterministic across timezone and DST transitions. The scheduled handover resolves to an instant in the effective timezone; the source window is the exact preceding 24 hours, preserving CR015's explicit 24-hour-window behavior.

## Per-Conversation Memory Formation

When a character/day becomes due:

1. Discover all qualifying Conversation-mode chats for the character that contain eligible messages in the completed window.
2. Freeze the source Conversation list for that formation attempt.
3. Process source Conversations **sequentially, one Conversation at a time**. Do not concatenate multiple Conversations into one LLM request.
4. For each source, build a speaker-attributed transcript for only that Conversation and completed window.
5. Call the configured formation model with the target character identity, editable formation prompt, and that source transcript.
6. Parse structured JSON containing zero or more `{ text, importance }` memories.
7. Persist the returned memories into the character/day pool and create their embeddings before they become retrieval-eligible.

The extraction prompt must make the target character explicit so that a multi-character Conversation yields only memories relevant to the character currently being processed. The full eligible source transcript remains available to the model because user messages and other participants' statements can be important context for that character's memory.

A source Conversation may validly produce zero memories. No second cross-Conversation LLM merge or consolidation pass is introduced in this CR; the character's day is the union of the source-specific extraction results.

Each automatically formed memory stores at least a stable memory ID, character ID, completed-day/window identity, source Conversation ID, text, importance score, and embedding/index linkage. Manual memories may have no source Conversation and must be distinguishable from automatically formed memories.

## Idempotency, Partial Failure, and Regeneration

Formation must not create duplicate memories when a timer fires twice, the process restarts, or startup catch-up overlaps a scheduled run. Persist formation state at character/day/source-Conversation granularity so each source can be recognized as pending, successful, empty-success, or failed.

If one source Conversation fails, successful source results remain valid and the failed source is retryable without rerunning already successful sources. A character/day is complete only when all frozen source Conversations have reached a terminal successful or empty-success state.

Manual regeneration of a completed day is destructive replacement, as in CR015. Regeneration rediscovers the eligible source Conversations for the original window, processes them sequentially, builds a complete replacement set, and swaps the day's memory set only after successful replacement formation. Clear confirmation is required before regeneration.

Manual add/edit/delete operations refresh or remove embeddings consistently. Deleting a source Conversation later does not silently delete already formed character memories; the stored source identifier becomes historical provenance.

## Reliable Scheduling and Startup Catch-Up

Add a server-owned Daily Memories scheduler rather than relying on the next chat generation to notice that formation is due.

### Normal running

- The scheduler calculates the next due handover for every enabled character.
- At the due instant it enqueues the completed character/day formation job.
- Source Conversations within a character/day job are strictly sequential.
- Scheduler/job concurrency must be bounded; an initial global concurrency of one is acceptable and avoids bursts of simultaneous formation requests.
- After a configuration change, the scheduler recalculates future due times without silently regenerating already completed historical days.

### Server startup and missed schedules

After storage and the HTTP server are ready, startup reconciliation runs automatically and non-blockingly:

- For every enabled character, calculate every completed character/day window that should already have been formed.
- Compare those windows with persisted formation state.
- Enqueue missing or retryable completed windows oldest-first.
- If the server starts after today's configured handover time, the just-completed window is therefore generated automatically without waiting for a chat message or another restart.
- If the server was offline across several handovers, all missing completed windows are caught up rather than only the most recent one.

The same reconciliation rules handle late timers caused by system sleep or event-loop delay. Job identity and persisted state make reconciliation safe to run repeatedly.

Shutdown clears future timers and prevents new jobs from starting while allowing persistence to remain consistent if an in-flight provider request fails or is interrupted.

## Character Memory Retrieval

Retrieval preserves CR015's low-latency model but changes the ownership boundary:

- While Daily Memories is enabled for a character, any Conversation generation involving that character may retrieve from that character's stored memory pool.
- Retrieval performs no memory-selection LLM call.
- It embeds the configured last `N` messages from the current Conversation, vector-prefilters the target character's memories, and deterministically reranks candidates using semantic similarity, importance, and recency.
- The configured minimum-rank threshold selects all qualifying memories; no fixed result-count cap is introduced.
- In multi-character Conversations, retrieve independently for each enabled character and keep injected blocks explicitly labelled by character and grouped by memory date.
- Retrieval failure must degrade safely without blocking ordinary message generation.

Daily Memories remain independent of upstream automatic summaries and the existing memory-recall feature. Prompt assembly must clearly delimit these sources when more than one is enabled.

## Character Memory UI

Move the feature into the Character editor. Add a **Memories** tab alongside the existing character tabs and make it the single character-scoped home for Daily Memories configuration and maintenance.

Preserve CR015's day-oriented editing model:

- Group memories by completed memory day in chronological structure.
- Show editable memory text and editable importance score from 1 through 5.
- Allow adding a manual memory to any completed day.
- Allow editing or deleting individual memories.
- Allow deleting all memories for a selected day.
- Show missing completed days and allow generating one specific missing day.
- Allow destructive regeneration of a selected completed day after confirmation.
- Reject generation/regeneration of the current incomplete window.
- Preserve explicit save/cancel behavior and clear pending, success, empty, partial-failure, and error states.
- Show animated progress while formation/regeneration is running.
- Keep the layout compact and scrollable in the same spirit as CR015's Daily Memories editor.

Automatically formed entries may show their source Conversation name as subtle read-only provenance; manually created entries are labelled manual. Source metadata must not make normal editing materially noisier than CR015.

Character-level configuration controls live in the same Memories tab. A retrieval preview may select one of the character's qualifying Conversations as the recent-message query source, preserving CR015's preview concept without making the settings Conversation-owned.

## Interaction With Existing Upstream Features

- Current Pasta-Devs automatic Conversation summaries remain unchanged and continue using their own Conversation metadata, rollover behavior, editor, and prompt-context path.
- Existing memory recall remains independent.
- CR042 does not require Daily Memories to be represented as a chat agent and therefore does not enter the generic per-turn agent pipeline.
- Current upstream `Chat.characterIds` is the authoritative relationship used to discover a character's Conversation-mode chats.
- Existing Conversation timezone helpers and connection-resolution infrastructure should be reused rather than duplicated where their semantics match this design.

## Migration and Legacy CR015

The implementation base is current Pasta-Devs upstream, where the archived fork-local CR015 implementation is absent. CR042 therefore defines a clean character-owned persistence model and does not copy the archived CR015 schema or code wholesale.

If CR042 is later integrated over a branch/database that still contains legacy Conversation-owned CR015 records, legacy data migration must be assessed explicitly during integration. It must not be silently guessed for multi-character Conversations where ownership is ambiguous.

## Risks

- A heavily used character may participate in many Conversations, increasing formation time and provider cost. Sequential source processing and bounded scheduler concurrency make this predictable but may create a backlog.
- Independent source extraction can produce duplicate or conflicting memories across Conversations. This CR intentionally avoids a second consolidation LLM pass; user review/edit/delete remains the correction mechanism.
- Timezone, DST, or handover changes can create unintuitive historical boundaries unless window identity is persisted rather than recomputed later.
- Startup catch-up after a long outage can enqueue many historical jobs; the queue must remain bounded, visible in logs, and restart-safe.
- Partial provider/vector failures must not leave text persistence, embeddings, and formation completion state inconsistent.
- Character deletion must cascade or safely orphan-clean character memory/configuration records and vector entries.
- Multi-character Conversation retrieval can increase prompt size; per-character delimiting and threshold filtering are required.

## Validation

- Verify exact 24-hour completed-window boundaries at the configured handover and effective timezone, including DST transitions.
- Verify Conversation discovery includes every qualifying Conversation for the character and excludes other modes and unrelated characters.
- Verify source Conversations are sent to formation strictly one at a time and never concatenated into a cross-chat request.
- Verify multi-character transcripts preserve speaker attribution and the extraction result is scoped to the target character.
- Verify zero-memory source success, structured output validation, importance bounds, persistence, embedding-on-write, and historical source provenance.
- Verify character/day/source idempotency across duplicate timer firing, retry, restart, and startup reconciliation.
- Verify one-source failure does not duplicate successful sources and that retry can complete the day.
- Verify server startup after the handover automatically processes the missed completed window, and multi-day downtime catches up all missing completed windows oldest-first.
- Verify schedule changes recalculate future work without regenerating completed days.
- Verify manual add/edit/delete, day delete, missing-day generation, and destructive regeneration while rejecting the current incomplete window.
- Verify retrieval searches only the target character's memory pool, makes no selection LLM call, respects configured ranking/thresholds, and separates multiple characters' blocks.
- Verify summaries and existing memory recall continue to work independently.
- Verify the Character Memories tab, settings, day editor, progress/error/partial states, provenance display, and retrieval preview on desktop and narrow layouts.
- Run relevant focused regression coverage, `pnpm db:push` if the new persistence schema requires it, and the repository baseline `pnpm check`.
- After implementation, agree whether to add focused CR042 Playwright E2E coverage under the existing project harness.