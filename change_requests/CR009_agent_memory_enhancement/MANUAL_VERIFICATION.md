# CR009 Manual Verification Guide

Use this after CR009 has been merged into `upstream-main` and the app is running from that post-merge branch.

## Prerequisites

1. Check out and update the app branch:

   ```powershell
   cd Marinara-Engine
   git checkout upstream-main
   git pull origin upstream-main
   pnpm install
   pnpm check
   ```

2. Start the app with a test data directory if you want isolated evidence:

   ```powershell
   $env:DATA_DIR="$PWD\.manual-cr009-data"
   pnpm dev
   ```

3. Configure at least one chat-capable LLM connection.
4. Use a disposable roleplay chat with one or more characters.
5. Keep server logs visible. For storage evidence, inspect:

   ```text
   DATA_DIR/storage/tables/agent_memory.json
   ```

## Use Case 1: Secret Plot Agent Regression

This verifies that the existing secret plot agent still works through enhanced agent memory and keeps its current behavior.

### Setup

1. Create or open a roleplay chat with at least one character.
2. Open the Agents settings for the chat.
3. Enable `Secret Plot Driver`.
4. Make sure the agent has a valid model/connection.
5. If available in the UI, enable the Secret Plot panel/tab for the chat so the stored arc and scene directions can be inspected.

### Verification Steps

1. Send a story-starting message, for example:

   ```text
   Start a tense mystery scene in a quiet coastal town. My character has just arrived after receiving an anonymous warning.
   ```

2. Generate 3-5 assistant turns, giving the story enough context to create an arc and scene directions.
3. Confirm the Secret Plot panel shows stored state, especially:
   - overarching arc
   - scene directions
   - pacing
   - stale/recently fulfilled direction state, if visible
4. Inspect `storage/tables/agent_memory.json`.
5. Confirm rows exist for the secret plot agent with these keys:
   - `overarchingArc`
   - `sceneDirections`
   - `recentlyFulfilled`
   - `pacing`
   - `staleDetected`
6. Confirm those rows are represented as enhanced memory records:
   - `memoryType` / `memory_type` should be `secret_plot_internal`
   - `agentConfigId` / `agent_config_id` should belong to the secret plot agent
   - `chatId` / `chat_id` should match the current chat
   - `metadata.rawValue` should contain the original structured value where applicable
7. Continue the chat for 2-3 more turns.
8. Confirm the same keys are updated rather than duplicated repeatedly.
9. If the Secret Plot panel supports editing, edit the overarching arc, save it, refresh the page, and confirm the edited value persists.
10. If the UI has a clear-runs or reroll control for secret plot, use it and confirm `overarchingArc` is preserved while transient scene directions can be refreshed.

### Pass Criteria

- Secret Plot Driver still runs successfully.
- Secret plot prompt injection continues to affect the story.
- Existing keys are persisted in `agent_memory.json`.
- Existing key/value behavior is preserved through enhanced records.
- No unrelated agent memory records become visible to ordinary custom agent list/search calls.

## Use Case 2: Two-Agent Character Memories Scenario

This verifies custom agents can create durable character memories and retrieve relevant memories by semantic search.

The scenario uses two custom agents:

- `Character Memory Writer`: post-processing agent that saves durable memories every N user messages.
- `Character Memory Retriever`: pre-generation agent that searches relevant memories every turn and injects them into the next prompt.

### Agent A: Character Memory Writer

Create a custom agent with these settings:

| Setting | Value |
| --- | --- |
| Name | `Character Memory Writer` |
| Phase | `Post-Processing` |
| Result type | `Context Injection` or the default non-rewrite result type |
| Trigger Cadence | `3` user messages for normal testing, or `1` for fast testing |
| Enabled tools | `save_agent_memory` |
| Max tool calls | `2` or higher |

Prompt:

```text
You are Character Memory Writer. Your job is to save durable character memories for continuity.

After each assistant response, review the recent conversation and decide whether there is a new durable memory worth storing.

Save only information that should matter later, such as:
- a character preference
- a promise or obligation
- a relationship change
- a fear, secret, goal, injury, item, location, or unresolved clue
- a fact the character learned and may act on later

Do not save transient narration, generic mood, or facts already obvious from the current scene.

When there is a useful memory, call save_agent_memory with:
- memoryType: "character_memory"
- title: a short label
- content: one concise, self-contained sentence
- characterName: the character the memory belongs to, if an active character is clearly associated
- key: a stable lowercase kebab-case key when this updates an existing fact
- metadata: include source "manual-cr009", confidence "high" or "medium", and the involved character names
- semanticIndex: true

Examples:
- "Mira promised Jonas she would not reveal the lighthouse signal to the town guard."
- "Jonas is afraid of deep water after the ferry accident."
- "Mira prefers direct honesty and reacts badly to evasive answers."

If there is no durable memory worth saving, do not call any tool.

After tool use, respond with a short internal note only:
MEMORY_WRITER: saved <count> memory record(s).
or
MEMORY_WRITER: no durable memory found.
```

### Agent B: Character Memory Retriever

Create a second custom agent with these settings:

| Setting | Value |
| --- | --- |
| Name | `Character Memory Retriever` |
| Phase | `Pre-Generation` |
| Result type | `Context Injection` |
| Trigger Cadence | `1` / `Every run` |
| Enabled tools | `search_agent_memory` |
| Max tool calls | `2` or higher |

Prompt:

```text
You are Character Memory Retriever. Before the assistant replies, retrieve durable character memories that may help preserve continuity.

Use the user's latest message, the current scene, and active character names to form a compact search query.

First call search_agent_memory with:
- memoryType: "character_memory"
- mode: "semantic"
- query: the compact search query
- limit: 5

If semantic search returns an error or no useful results, call search_agent_memory again with:
- memoryType: "character_memory"
- mode: "fuzzy"
- query: the same compact search query
- limit: 5

Return only useful memories. Do not invent memories. Do not mention tool failures unless no fallback results exist.

Output format:
Relevant character memories:
- <memory content>
- <memory content>

If nothing relevant is found, output exactly:
Relevant character memories: none.
```

### Test Conversation

Use a chat with two named characters if possible. The exact names do not matter, but the prompts below assume `Mira` and `Jonas`.

1. Seed a memory:

   ```text
   Mira pulls Jonas aside and admits that she hates being lied to because her former mentor betrayed her. Jonas promises he will tell her the truth about the lighthouse signal when they are alone.
   ```

2. Continue for enough user messages to trigger the writer cadence. If the writer cadence is `3`, send two more simple story-driving messages.
3. Inspect server logs or the agent debug output and confirm `save_agent_memory` was called.
4. Inspect `storage/tables/agent_memory.json` and confirm a record exists with:
   - `memoryType` / `memory_type`: `character_memory`
   - content about Mira, Jonas, honesty, the mentor betrayal, or the lighthouse promise
   - `metadata.source`: `manual-cr009`
   - `embedding` present when local embeddings are available
5. Ask a later message that should require the memory:

   ```text
   Jonas hesitates when Mira asks what he knows about the lighthouse signal. She studies his face and waits.
   ```

6. Confirm the retriever calls `search_agent_memory`.
7. Confirm the retriever output injects the saved memory, such as Mira's hatred of lies or Jonas's promise.
8. Confirm the main assistant response uses the retrieved memory naturally.

### Semantic Search Checks

Run this once with a query that is conceptually related but does not repeat exact wording:

```text
Mira asks Jonas whether he is hiding anything important from her.
```

Pass criteria:

- `search_agent_memory` with `mode: "semantic"` returns relevant memories when embeddings are available.
- If embeddings are unavailable, the tool returns a clear semantic-unavailable result and the retriever falls back to fuzzy search.
- Fuzzy fallback still finds obvious overlap-based memories.

### Isolation Checks

1. Create a second chat using the same characters.
2. Ask a prompt related to the stored memory.
3. Confirm the retriever does not return memories from the first chat.
4. Create or enable a different custom agent and give it `search_agent_memory`.
5. Confirm it does not see records owned by the writer/retriever agent unless the intended ownership model explicitly allows that agent to access them.

## Evidence To Capture

- Screenshot of the custom writer agent settings.
- Screenshot of the custom retriever agent settings.
- Agent debug/tool result output showing:
  - `save_agent_memory`
  - `search_agent_memory`
- A redacted snippet from `storage/tables/agent_memory.json` showing:
  - one `secret_plot_internal` record
  - one `character_memory` record
- A transcript excerpt where the retrieved memory changes or preserves the assistant response.

## Expected Issues To Watch For

- The writer saves duplicate records instead of updating a stable keyed memory.
- The retriever searches before the writer has ever saved anything.
- Semantic search is unavailable because no local embedding path is configured; fuzzy fallback should still work.
- The main generation sees agent-memory tools directly. It should not; only the custom agent execution context should use them.
- Secret plot records are returned by ordinary custom-agent searches. They should remain internal/protected unless explicitly included by trusted paths.
