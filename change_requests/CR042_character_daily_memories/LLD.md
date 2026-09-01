# Low-Level Design: Character Daily Memories

## 1. Change Overview

CR042 reimplements archived CR015 on the current Pasta-Devs codebase but moves the ownership boundary from one Conversation to one character.

The core runtime is:

```text
scheduled character handover
    -> completed exact 24h window
    -> discover all qualifying Conversation chats for that character
    -> process source Conversation A completely
    -> process source Conversation B completely
    -> ...
    -> persist character/day memories + embeddings

Conversation generation involving that character
    -> embed configured recent messages from the current Conversation
    -> rank only that character's active Daily Memories
    -> inject character/date-grouped memory block
```

The implementation must preserve four invariants:

1. memories belong to the character, not to the source Conversation;
2. two source Conversations are never mixed in one extraction context;
3. automatic formation is driven by a server scheduler and survives downtime through persisted reconciliation state;
4. regeneration never destroys the currently active day until a complete replacement run succeeds.

---

## 2. Persistence Model

Create `packages/server/src/db/schema/character-daily-memories.ts` and export it from `packages/server/src/db/schema/index.ts`.

Use dedicated file-backed tables rather than `CharacterData.extensions` or chat metadata. Daily-memory configuration is operational state, not character-card content, and must not create character version snapshots.

### 2.1 `character_daily_memory_settings`

One row per character.

Conceptual fields:

```text
characterId              text primary key, FK -> characters.id ON DELETE CASCADE
enabled                  text "true"/"false"
handoverTime             text HH:mm, default "04:00"
formationConnectionId    text nullable
formationPrompt          text
retrievalMessageCount    integer, default CR015 value
semanticWeight           integer, default 50
importanceWeight         integer, default 35
recencyWeight            integer, default 15
minimumRankPercent       integer, default 30
autoStartWindowEndAt     text nullable ISO instant
createdAt                text ISO
updatedAt                text ISO
```

`formationConnectionId = null` means resolve the default agent connection. A stored connection ID may also be an existing supported sentinel such as `random` or Local Model when the connection layer already supports it.

`autoStartWindowEndAt` is the first window end eligible for automatic reconciliation for the current enablement period.

Enable transition rules:

- false/missing -> true: calculate the most recently completed handover and persist that instant as `autoStartWindowEndAt`;
- true -> false: stop future automatic scheduling but retain data;
- false -> true later: reset `autoStartWindowEndAt` to the then-most-recent completed handover, so the disabled gap is not silently backfilled;
- changing handover while enabled does not rewrite historical day rows.

### 2.2 `character_daily_memory_days`

One stable historical window per character.

```text
id              text primary key
characterId     text FK -> characters.id ON DELETE CASCADE
dayKey          text YYYY-MM-DD, derived from window-end local calendar date
windowStartAt   text ISO instant
windowEndAt     text ISO instant
timeZone        text, snapshot used for this window
handoverTime    text HH:mm snapshot
status          enum pending | partial | complete | empty | failed | deleted
activeRunId     text nullable
createdAt       text ISO
updatedAt       text ISO
```

Require uniqueness on `(characterId, windowEndAt)`.

`dayKey` is display/grouping metadata. `windowEndAt` is the authoritative identity because timezone/handover changes can make local date labels ambiguous.

A day deleted by the user remains as `status = deleted`, `activeRunId = null`. The scheduler treats that row as terminal and does not recreate it. Explicit Generate/Regenerate can clear the tombstone by creating a new run.

### 2.3 `character_daily_memory_runs`

A run is a complete candidate memory set for one day.

```text
id                    text primary key
dayId                 text FK -> day ON DELETE CASCADE
kind                  enum scheduled | startup | manual-generate | regenerate | manual-only
status                enum pending | running | partial | complete | empty | failed
sourceConversationIds text JSON array, frozen at run creation
connectionId          text nullable, resolved formation connection snapshot
model                 text nullable, resolved model snapshot
replacementOfRunId    text nullable
startedAt             text nullable
completedAt           text nullable
createdAt             text ISO
updatedAt             text ISO
```

Initial scheduled/startup/manual-generation runs become `day.activeRunId` immediately. Their successful source memories may therefore be visible while the run is partial.

Regeneration runs do **not** become active while processing. `replacementOfRunId` records the current active run. Only a fully successful/empty regeneration may switch `day.activeRunId` to the new run.

### 2.4 `character_daily_memory_run_sources`

One frozen source Conversation inside one run.

```text
id                      text primary key
runId                   text FK -> run ON DELETE CASCADE
sourceConversationId    text, historical provenance; deliberately no chat FK
sourceConversationName  text snapshot
status                  enum pending | running | success | empty | failed
attempts                integer
lastError               text nullable
nextRetryAt              text nullable
createdAt               text ISO
updatedAt               text ISO
```

Require uniqueness on `(runId, sourceConversationId)`.

Do not add an FK to `chats`. Deleting a Conversation must not delete memories already formed from it.

### 2.5 `character_daily_memories`

```text
id                      text primary key
characterId             text FK -> characters.id ON DELETE CASCADE
dayId                   text FK -> day ON DELETE CASCADE
runId                   text FK -> run ON DELETE CASCADE
runSourceId              text nullable FK -> run-source ON DELETE CASCADE
origin                   enum formed | manual
sourceConversationId    text nullable
sourceConversationName  text nullable
text                     text
importance               integer 1..5
embedding                text nullable JSON float[]
embeddingSpaceId         text nullable
createdAt                text ISO
updatedAt                text ISO
```

Every memory belongs to one run/set. A manual memory is added to the current active run. If a user manually adds to a completed day that has no row/run, create a `manual-only` run, make it active, and treat the day as terminal for automatic reconciliation. Explicit regeneration can later replace it.

### 2.6 File-backed storage registration

Update current file-backed table inventory/cascade configuration in `packages/server/src/db/file-backed-store.ts` and any synchronized protected-table list such as `scripts/protect-launcher-data.mjs`.

Character deletion must cascade settings, days, runs, run-sources, and memories. Run/day deletion must cascade child rows without relying on manual cleanup ordering.

---

## 3. Shared Contracts

Create:

- `packages/shared/src/types/character-daily-memory.ts`
- `packages/shared/src/schemas/character-daily-memory.schema.ts`

Export through the existing shared barrels.

### 3.1 Defaults

Centralize CR015 defaults:

```text
handoverTime = "04:00"
semanticWeight = 50
importanceWeight = 35
recencyWeight = 15
minimumRankPercent = 30
recencyHalfLifeDays = 30
```

The default prompt requests up to ten nuanced short-paragraph memories when warranted, permits fewer/zero, and requires importance 1..5. Ten remains a prompt instruction, not a persistence/UI hard cap.

### 3.2 Formation output

Validate:

```text
{
  memories: [
    { text: non-empty string, importance: integer 1..5 }
  ]
}
```

Zero entries is valid success.

### 3.3 API response types

Expose typed settings, day status, source status, memory rows, missing-day descriptors, qualifying Conversation descriptors, and preview results. Client code should not interpret raw storage rows.

---

## 4. Timezone and Window Resolution

Reuse `packages/server/src/services/conversation/timezone.ts`.

The current file already contains private `zonedWallClockToInstant()`. Promote it through a public wrapper/export rather than reimplementing timezone conversion in CR042.

Create `packages/server/src/services/character-daily-memories/window.ts` with pure helpers:

```text
parseHandoverTime("HH:mm")
resolveHandoverInstant(calendarDate, handoverTime, timeZone)
mostRecentCompletedWindow(now, handoverTime, timeZone)
nextScheduledWindow(afterWindowEnd, handoverTime, timeZone)
enumerateCompletedWindows(fromWindowEnd, throughNow, handoverTime, timeZone)
```

A memory window is always:

```text
windowEnd = resolved local handover instant
windowStart = windowEnd - exactly 24 hours
eligible timestamps: createdAt >= windowStart && createdAt < windowEnd
```

The next due handover is derived from the **next local calendar date**, not by adding 24 hours to the previous due instant. This keeps the scheduled wall-clock time stable through DST while retaining CR015's exact 24-hour source-window rule.

Persist `timeZone`, `handoverTime`, `windowStartAt`, and `windowEndAt` on each day. Never recompute a historical window from current settings.

### 4.1 Effective server timezone

Create a small server helper that reads app setting key `ui` through `createAppSettingsStorage()`, parses the synced JSON blob, and validates `conversationTimeZone` with `normalizePromptTimeZone()`.

If missing/invalid, pass `undefined` to existing timezone helpers, preserving current server-local Conversation semantics.

When `PUT /api/app-settings/ui` changes the synced value, request a Daily Memory scheduler refresh after persistence succeeds.

---

## 5. Source Conversation Discovery

Implement in the Daily Memories service/storage boundary; do not add a cross-chat LLM preprocessing pass.

For one character/window:

1. select candidate chats with `mode = conversation`; optionally use `lastMessageAt >= windowStart` as a cheap prefilter;
2. parse each chat's JSON `characterIds` and retain chats containing the target character ID;
3. query messages in `[windowStart, windowEnd)`;
4. retain non-empty user/assistant/narrator messages;
5. exclude `role = system` and any known internal-only message representation;
6. if no eligible messages remain, the chat is not a frozen source for this run.

The frozen run stores source IDs in deterministic order, preferably `(firstEligibleMessageAt, chatId)` or `(chat.createdAt, chatId)`. That order is also execution order so repeated retries are predictable.

Snapshot each source Conversation name when the run is created.

---

## 6. Transcript Construction

Use current persisted active message content and current speaker identities.

For each source:

```text
[time] User Name: ...
[time] Character A: ...
[time] Character B: ...
Narrator: ...
```

Reuse `stripConversationPromptTimestamps()` where relevant so existing prompt-only timestamp wrappers are not learned as memories.

Resolve:

- user speaker from the Conversation persona when available, otherwise the current upstream fallback used by Conversation summaries;
- assistant speaker from `message.characterId` -> character name;
- narrator as `Narrator`.

The formation system prompt explicitly states the **target character name and ID** and instructs the model to retain only memories that matter to that character, even though the transcript includes statements from other participants.

### 6.1 Oversized source transcript

A single source Conversation remains the unit of isolation. If the source cannot fit the provider context, split only that source transcript into bounded chunks using a deterministic character-count/token-safe strategy analogous to current auto-summary chunking.

Process all chunks for source A before source B begins. Union the validated chunk memory arrays into source A's result. Do not run a second LLM consolidation pass.

---

## 7. Formation Connection Resolution

Create `packages/server/src/services/character-daily-memories/connection-resolution.ts` based on the established chat-summary connection resolver patterns.

Candidate order:

1. configured `formationConnectionId`;
2. default agent connection.

Use existing Local Model/random behavior where supported and wrap the selected provider with the existing agent fallback connection.

Do **not** fall back to a source Conversation's `chat.connectionId`; doing so would make one character/day use unrelated models based on source-chat ordering.

The resolved `connectionId` and `model` are snapshot onto the run for diagnostics/reproducibility.

If no usable text model exists, the run/source fails with a retryable/hard classification consistent with existing provider behavior; ordinary chat generation is unaffected.

---

## 8. Embeddings and Vector-Space Consistency

Reuse:

- `resolveMemoryRecallEmbeddingSource()` from `memory-recall-embedding.ts`;
- `embedMemoryRecallTexts()` and `DEFAULT_LOCAL_MEMORY_EMBEDDING_SPACE_ID` from `memory-recall.ts`.

For a character, resolve the embedding source from the resolved Daily Memory formation connection. If that connection has no remote embedding configuration, use the existing local embedding fallback.

### 8.1 Write path

Embedding is best-effort for each valid formed, manual, or edited memory:

1. attempt to embed its text with `inputType = document`;
2. when embedding succeeds, persist the JSON vector and the source's stable `spaceId`;
3. if no configured source exists and local embedding succeeds, store the existing local-space ID;
4. when embedding fails, persist the valid memory text, importance, and provenance with both `embedding` and `embeddingSpaceId` null. The row is non-retrieval-eligible.

An embedding failure does not create an embedding-pending/degraded state, fail the source, or schedule a CR-specific retry. The formation result remains durable and is not extracted again solely because vectorization failed.

### 8.2 Formation connection changes

Changing `formationConnectionId` may change vector space.

After settings persistence:

- resolve the new embedding source;
- enqueue a serialized re-vectorization pass over the character's active memories;
- replace each memory's vector/space ID only after its new vector succeeds;
- retrieval filters candidates to the query's current `embeddingSpaceId`, so old-space rows are temporarily skipped rather than compared incorrectly.

Do not delete memory text if re-vectorization fails.

---

## 9. Formation Orchestration and Idempotency

Create `formation.service.ts` with a public operation conceptually like:

```text
ensureCharacterMemoryDay(characterId, window, trigger)
runCharacterMemoryDay(runId)
retryRunSource(runSourceId)
regenerateCharacterMemoryDay(dayId)
```

### 9.1 Initial scheduled/startup/manual generation

Within a storage transaction/serialized mutation boundary:

1. find/create day by `(characterId, windowEndAt)`;
2. if day is `deleted`, automatic triggers return without work;
3. if an active terminal run already covers the day, automatic duplicate triggers return;
4. discover/freeze sources;
5. create run and run-source rows;
6. make the run active immediately for an initially missing day;
7. execute run sources sequentially.

For each source:

```text
pending/failed and retry due
    -> running, attempts += 1
    -> extract
    -> persist each valid returned memory and attempt embedding
    -> success OR empty, regardless of individual embedding outcomes

provider/parse failure
    -> failed + error + nextRetryAt
```

An embedding failure is handled on the memory row as described in §8.1; it does not enter the provider/parse failure path. Once valid memories have been persisted, the source is terminal `success` (or `empty` when it returned none), and ordinary retry/reconciliation never repeats extraction for that source.

Never rerun `success` or `empty` run-source rows during ordinary retry/reconciliation.

Day state:

- `empty`: all sources terminal and total active memories = 0;
- `complete`: all sources terminal and >=1 active memory;
- `partial`: some source success/empty and at least one failed/pending;
- `failed`: no source produced a terminal success/empty and work is currently failed;
- `pending`: work not yet materially attempted.

### 9.2 Zero qualifying sources

A completed window with no qualifying source Conversations is a valid `empty` day/run. Persist it so startup reconciliation does not repeatedly rediscover the same window.

### 9.3 Regeneration

Regeneration:

1. confirms the target day is completed and not the current incomplete window;
2. rediscovers sources from the day row's original `[windowStartAt, windowEndAt)` window;
3. creates a separate `regenerate` run with `replacementOfRunId = day.activeRunId`;
4. processes that run fully without changing the active run;
5. if all sources succeed/empty, transactionally switch `day.activeRunId` to the new run and update day status;
6. delete/retire the replaced run and its memories only after the pointer switch is durable;
7. on failure, preserve the old active run unchanged and expose the failed staging run as regeneration status.

This is the destructive replacement confirmation promised by the UI without destructive partial state.

### 9.4 Manual CRUD

- Add: attach to current active run; create a `manual-only` day/run if needed.
- Edit: update text/importance; re-embed before replacing the old vector.
- Delete memory: remove the row; do not auto-regenerate the source.
- Delete day: remove active/staging runs and memories, retain the day as `deleted` tombstone.

---

## 10. Scheduler Design

Create `packages/server/src/services/character-daily-memories/scheduler.service.ts`.

Follow lifecycle patterns from `server-autonomous-scheduler.service.ts`, but use exact due timers rather than a generation-eligibility poll as the primary mechanism.

Module state:

```text
stopped
refreshTimer / nextDueTimer
queue ordered by windowEndAt, characterId
queuedJobKeys Set<characterId|windowEndAt>
workerRunning boolean
```

Global formation concurrency defaults to **1**.

### 10.1 Startup

`startCharacterDailyMemoryScheduler(app)` is called from `buildApp()` beside `startServerAutonomousScheduler(app)`.

It must not block server startup. Schedule the initial reconciliation asynchronously/deferred after startup wiring is complete.

Startup reconciliation:

1. load global Conversation timezone;
2. list enabled character settings;
3. for each character, enumerate local-calendar handovers from `autoStartWindowEndAt` through the most recently completed handover;
4. inspect persisted day/run/source state;
5. enqueue missing or retryable windows oldest-first;
6. ignore deleted tombstones and terminal completed/empty/manual-only days;
7. calculate the earliest future handover and arm the next due timer.

### 10.2 Normal due timer

When the timer fires:

- run the same reconciliation logic rather than assuming exactly one timer event was delivered;
- this covers laptop sleep, event-loop delay, clock changes, and duplicate timer firing;
- enqueue every newly due/missed window;
- recalculate the next timer.

### 10.3 Retry/backoff

Persist retry timing on run-source rows. Scheduler reconciliation may enqueue a partial/failed day only when at least one failed source is retryable now.

Use bounded exponential retry timing consistent with existing server background services. Persisted source status means restart does not reset idempotency.

### 10.4 Refresh triggers

Expose a module-level safe refresh request that is a no-op before scheduler start.

Call it after:

- Daily Memory enabled/handover/formation-connection settings update;
- synced `ui` app-settings update affecting Conversation timezone.

Debounce refresh requests so rapid slider/settings writes do not create timer churn.

### 10.5 Shutdown

Register `app.addHook("onClose", ...)` or an equivalent app lifecycle hook to:

- set `stopped`;
- clear timers;
- stop starting queued jobs;
- let any interrupted provider request fail naturally and leave persisted run-source state retryable on next startup.

---

## 11. Retrieval and Ranking

Create `retrieval.service.ts`.

Input:

```text
characterId
current Conversation messages
character settings
now
```

### 11.1 Query text

Take the configured last `N` eligible current-Conversation messages in chronological order and format speaker-attributed text. If no eligible messages exist, return no Daily Memories.

Embed with the character's current embedding source using `inputType = query`.

### 11.2 Candidate set

Load memories that:

- belong to the target character;
- belong to each day's `activeRunId` only;
- have non-null embedding;
- have `embeddingSpaceId` equal to the current query space;
- are not attached to a deleted day.

Persisted memories whose vectorization failed have null embedding/space and are excluded until a user edit or current maintenance re-vectorization succeeds. There is no CR-specific retry path for those rows.

There is no final top-K cap.

### 11.3 Score

Normalize user weights by their sum; if all are zero, fall back to CR015 defaults.

For each candidate:

```text
semantic = clamp(cosine(query, memory), 0, 1)
importance = (importanceScore - 1) / 4
ageDays = max(0, (now - day.windowEndAt) / 86400000)
recency = 0.5 ^ (ageDays / 30)

rank = semantic*wSemantic
     + importance*wImportance
     + recency*wRecency
```

Select every memory with `rank >= minimumRankPercent / 100`.

Sort selected memories by:

1. rank descending for deterministic selection order;
2. window end descending;
3. stable memory ID.

For prompt presentation, regroup selected items chronologically by memory day so the model sees a coherent timeline while the selection itself remains rank-driven.

### 11.4 Failure behavior

Embedding/vector errors log and return no Daily Memory block. They must never fail the Conversation generation request.

No LLM call occurs during selection.

---

## 12. Conversation Context Integration

Modify `packages/server/src/routes/generate/conversation-history-runtime.ts`.

At the point where Conversation history/context sources are assembled and current chat/character IDs are known:

1. iterate the current Conversation's character IDs;
2. load Daily Memory settings for each;
3. skip disabled characters;
4. retrieve independently using the same recent current-Conversation message set;
5. format one block per character.

Conceptual output:

```text
<character_daily_memories character="Alice">
  <memory_day date="2026-08-31">
  - [importance 5] ...
  - [importance 3] ...
  </memory_day>
</character_daily_memories>

<character_daily_memories character="Bob">
  ...
</character_daily_memories>
```

Keep this distinct from:

- automatic Conversation day/week summaries;
- current semantic memory recall;
- recent verbatim messages.

Do not add CR042 to the generic agent pipeline.

---

## 13. HTTP API

Create `packages/server/src/routes/character-daily-memories.routes.ts` and register it in `routes/index.ts` with prefix `/api/characters`.

Routes:

```text
GET   /:characterId/daily-memories/settings
PATCH /:characterId/daily-memories/settings

GET   /:characterId/daily-memories/days
POST  /:characterId/daily-memories/generate
POST  /:characterId/daily-memories/days/:dayId/regenerate
DELETE/:characterId/daily-memories/days/:dayId

POST  /:characterId/daily-memories/memories
PATCH /:characterId/daily-memories/memories/:memoryId
DELETE/:characterId/daily-memories/memories/:memoryId

GET   /:characterId/daily-memories/conversations
POST  /:characterId/daily-memories/preview
```

### Settings PATCH

Accept partial settings. Normalize/validate on the server. Serialize mutation per character so rapid client changes cannot overwrite one another with stale reads.

If enable/handover changes, update scheduler anchor/refresh logic as required. If formation connection changes, trigger re-vectorization and scheduler refresh.

### Days GET

Return:

- persisted days with active run state/source status/memories;
- computed manually-generatable missing completed windows from character Conversation history, bounded to dates that actually contain qualifying messages rather than returning an infinite calendar.

Automatic catch-up eligibility and UI-visible manually missing history are separate concepts.

### Generate

Body identifies a completed `windowEndAt` descriptor returned by Days GET. Server recomputes/validates the exact window and rejects the current incomplete window.

### Preview

Body contains one qualifying `chatId`. Validate that the chat is Conversation mode and contains the character. Use that chat's last `N` messages as retrieval query and return only selected day-grouped character memories plus rank diagnostics needed by the UI; do not modify memory state.

---

## 14. Client Design

Create `packages/client/src/hooks/use-character-daily-memories.ts` using React Query.

Queries:

- settings;
- days;
- qualifying Conversations for preview.

Mutations:

- settings patch;
- generate/regenerate/day delete;
- memory add/edit/delete;
- preview.

Invalidate only CR042 character keys after mutations. Keep async work out of Zustand.

### 14.1 `CharacterEditor.tsx`

Add:

```text
{ id: "memories", label: "Memories", ... }
```

Place it adjacent to `Convo` because the data is character-owned but Conversation-runtime-specific.

Render a focused `CharacterMemoriesTab` rather than implementing the workflow inline.

### 14.2 `CharacterMemoriesTab.tsx`

Top configuration area:

- Enabled switch;
- Handover `<input type="time">`;
- formation connection selector;
- recent-message count;
- semantic/importance/recency influence controls;
- minimum-rank slider;
- editable formation prompt with Reset;
- preview Conversation selector + Preview action/result.

Day management area:

- chronological/collapsible day groups;
- status badge/text: complete, empty, partial, failed, deleted/missing;
- compact memory cards with textarea and narrow importance control;
- subtle source Conversation provenance for formed memories; `Manual` for manual entries;
- Add Memory;
- Delete memory;
- Delete Day confirmation;
- Generate missing/deleted day;
- Regenerate confirmation;
- animated in-progress state while generation/regeneration runs;
- explicit save/cancel semantics for edits;
- one reliable scroll surface over the tab/day list.

The visual language should follow CR015's Daily Memories editor and current Character Editor controls rather than introduce a new design system.

---

## 15. Logging and Diagnostics

Use structured/log-prefix diagnostics such as `[character-daily-memories]`.

Log at minimum:

- scheduler startup and next due handover;
- catch-up queue size;
- character/day/run ID;
- source Conversation start/success/empty/failure;
- retries/backoff;
- regeneration swap;
- embedding-space/revectorization events;
- retrieval degradation due to unavailable/mismatched vectors.

Do not log full transcripts or memory text by default.

---

## 16. Regression Coverage

Create focused regression coverage, preferably `scripts/regressions/character-daily-memories.regression.ts` with small exported pure helpers and fake provider/embedder boundaries.

Required cases:

1. most recent/next handover at ordinary dates;
2. exact 24-hour `[start,end)` window;
3. DST spring/fall wall-clock scheduling while source window remains exactly 24h;
4. enable/re-enable anchor avoids whole-history automatic backfill;
5. deleted tombstone suppresses automatic reconciliation;
6. source discovery includes all target-character Conversation chats and excludes other modes/characters;
7. multi-character transcript retains speakers but target character is explicit;
8. source B never begins before all source A chunks complete;
9. zero-memory extraction is terminal success;
10. malformed JSON / invalid importance becomes source failure without duplicate successful-source writes;
11. duplicate job trigger returns the same day/run rather than creating duplicates;
12. restart/reconciliation resumes only pending/failed sources;
13. regeneration failure leaves old active run untouched;
14. successful regeneration swaps active run once;
15. manual edit re-embeds; delete removes retrieval eligibility;
16. connection/embedding-space change excludes stale-space vectors and re-vectorizes;
17. 50/35/15 ranking, score-5 boost, 30-day half-life, threshold, arbitrary-weight normalization;
18. no final result-count cap;
19. startup after one/multiple missed handovers queues oldest-first;
20. multi-character context formatting is separated and deterministic.

Add `regression:character-daily-memories` to root `package.json` using the repository's existing regression execution pattern.

After focused regression passes, run one `pnpm check` for the complete change.

Playwright API/UI coverage remains a post-implementation user decision under the parent harness.

---

## 17. File Change Summary

| File/Area | Action | Purpose |
| --- | --- | --- |
| `packages/shared/src/types/character-daily-memory.ts` | Create | CR042 public types/defaults. |
| `packages/shared/src/schemas/character-daily-memory.schema.ts` | Create | Validate settings/API/formation contracts. |
| shared barrel files | Modify | Export CR042 contracts. |
| `packages/server/src/db/schema/character-daily-memories.ts` | Create | Dedicated character memory persistence. |
| `packages/server/src/db/schema/index.ts` | Modify | Export new tables. |
| `packages/server/src/db/file-backed-store.ts` | Modify | Register tables/cascades/sharding. |
| `scripts/protect-launcher-data.mjs` | Modify if required | Keep protected table inventory synchronized. |
| `packages/server/src/services/storage/character-daily-memories.storage.ts` | Create | Transactional/idempotent persistence operations. |
| `packages/server/src/services/character-daily-memories/window.ts` | Create | Handover/window enumeration. |
| `packages/server/src/services/character-daily-memories/connection-resolution.ts` | Create | Stable character formation connection. |
| `packages/server/src/services/character-daily-memories/formation.service.ts` | Create | Source discovery/extraction/run orchestration. |
| `packages/server/src/services/character-daily-memories/embedding.service.ts` | Create | Embedding/re-vectorization. |
| `packages/server/src/services/character-daily-memories/retrieval.service.ts` | Create | Ranking and memory selection. |
| `packages/server/src/services/character-daily-memories/scheduler.service.ts` | Create | Scheduled execution/startup catch-up. |
| `packages/server/src/services/conversation/timezone.ts` | Modify | Export wall-clock instant helper. |
| `packages/server/src/routes/character-daily-memories.routes.ts` | Create | Character-scoped API. |
| `packages/server/src/routes/index.ts` | Modify | Register CR042 routes. |
| `packages/server/src/routes/app-settings.routes.ts` | Modify | Refresh scheduler after timezone changes. |
| `packages/server/src/routes/generate/conversation-history-runtime.ts` | Modify | Retrieve/inject CR042 context. |
| `packages/server/src/app.ts` | Modify | Scheduler lifecycle. |
| `packages/client/src/hooks/use-character-daily-memories.ts` | Create | React Query API boundary. |
| `packages/client/src/components/characters/CharacterEditor.tsx` | Modify | Add Memories tab. |
| `packages/client/src/components/characters/CharacterMemoriesTab.tsx` | Create | CR042 UI. |
| `scripts/regressions/character-daily-memories.regression.ts` | Create | Focused behavior regression. |
| `package.json` | Modify | Add focused regression command. |

---

## 18. Intentionally Unchanged Areas

- Existing automatic Conversation day/week summary persistence and prompt logic.
- Existing `memory_chunks` ownership and current memory-recall chunk creation.
- Generic agent execution/cadence pipeline.
- Roleplay and Game generation.
- Character card export/import format: CR042 operational memories/configuration do not become portable card content.
- Legacy CR015 Conversation-owned data migration.

---

## 19. Implementation Order

Recommended dependency order:

```text
shared contracts
 -> schema/file-store registration
 -> storage
 -> time/window helpers
 -> connection + embedding helpers
 -> formation/orchestration
 -> scheduler
 -> HTTP API
 -> retrieval/context injection
 -> client hook/tab
 -> regressions/check
```

Do not start with UI or scheduler wiring before the persisted day/run/source invariants are in place; restart safety depends on those records being authoritative.
