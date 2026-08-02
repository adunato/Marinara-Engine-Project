# CR032 — Two-Pass Conversation Generation

## Status

Proposed. Application branch: `change/CR032-two-pass-conversation-generation`.

The Conversation Briefing and Conversation Writer prompt bodies are intentionally left as placeholders in this change request. Their content must be defined and approved before implementation is considered complete.

## Problem

Conversation generation currently resolves the available character, persona, memory, summary, transcript, current-context, lore, connected-chat, and agent context into one prompt and asks one model call to both understand that context and write the visible response.

The proposed alternative separates those responsibilities:

1. a hidden context-curation call reads the resolved Conversation context and produces a Conversation Briefing; and
2. a response-writing call receives that briefing through a separate writer prompt and produces the visible chat message.

This cannot be implemented as an ordinary pre-generation context-injection agent. Ordinary agent output supplements the existing main prompt, while this design requires the original context to be unavailable to the response-writing call.

The alternative therefore needs to be an explicit Conversation message-generation pipeline selected in the chat's General Settings. It may reuse existing context-resolution and response-lifecycle infrastructure, but its prompt-to-response path is separate from standard Conversation generation.

## Goals

- Add a per-Conversation setting that explicitly selects Standard or Two-Pass message generation.
- Keep Standard Conversation generation unchanged when the alternative pipeline is not selected.
- Reuse the existing resolution of Conversation context sources wherever their semantics remain applicable.
- Run a hidden context-curation model call before the visible response call.
- Ensure the response-writing call cannot receive the original character card, persona card, summaries, memories, transcript, lore, awareness, or pre-generation context directly.
- Manage the two-pass prompt templates through the existing prompt-preset system while making their use visibly distinct from the regular Conversation prompt.
- Expose the settings required to run and inspect the alternative pipeline from the chat's General Settings.
- Preserve existing streaming, cancellation, message persistence, command handling, tool execution, usage reporting, and post-generation processing after the writer call.
- Provide enough diagnostics to confirm which pipeline ran and what each model call received.
- Leave both prompt bodies as explicit placeholders until separately authored and approved.

## Non-goals

- Replacing or redesigning Standard Conversation generation.
- Applying the new pipeline to Roleplay, Visual Novel, or Game chats.
- Implementing the alternative as a generic custom agent or Prompt Patch agent.
- Defining a fixed JSON ontology or hard-coded Conversation Briefing schema in application code.
- Writing the Conversation Briefing or Conversation Writer prompt content in this CR document.
- Integrating Character Mind queries into response generation in the first implementation.
- Changing Daily Memories, Daily Intentions, automatic summaries, Memory Recall, lorebooks, or cross-chat awareness as independent features.
- Adding a third routine critique or response-rewrite model call.
- Adding the pipeline to the new-chat setup wizard in the first implementation; it is enabled from an existing chat's General Settings.

## Pipeline Selection and UI

### General Settings control

Conversation Chat Settings will add a **Message generation pipeline** control in the General section:

- **Standard** — the existing Conversation prompt and single response-model call.
- **Two-pass** — the new Conversation Briefing call followed by the isolated response-writing call.

The default is **Standard** for existing and newly created chats. Importing or opening an older chat without the setting must continue to use Standard generation.

Selecting **Two-pass** expands a settings panel containing:

1. **Context curator connection**
   - Default: use the chat's active text-generation connection.
   - Optional override: select another usable text-generation connection for the first pass.
   - The second pass continues to use the chat's active generation connection.
2. **Context curator maximum output tokens**
   - A bounded first-pass output budget independent of the writer's output budget.
3. **Conversation Briefing prompt**
   - Shows whether the effective prompt comes from the selected preset or a chat-local override.
   - Provides an Edit action using the existing prompt-editing interaction.
   - Provides Reset when a chat-local override exists.
4. **Conversation Writer prompt**
   - Uses the same preset/custom/reset interaction.
5. **Configuration status**
   - Identifies missing prompt templates or an unavailable curator connection before generation begins.

When Two-pass is selected, the existing regular Conversation prompt control remains visible for transparency but is labelled as unused by the active pipeline. It is not deleted or overwritten, so switching back to Standard restores the previous configuration exactly.

The collapsed settings summary must show the active pipeline. During generation, the existing progress surface will distinguish at least **Preparing conversation briefing** from **Writing response**.

### Stored chat settings

The chat records the pipeline and chat-local overrides in metadata, using typed shared accessors rather than scattered raw metadata reads. The implementation may normalize names, but the logical settings are:

```ts
type ConversationGenerationPipeline = "standard" | "two_pass";

type ConversationTwoPassSettings = {
  pipeline: ConversationGenerationPipeline;
  curatorConnectionId: string | null;
  curatorMaxOutputTokens: number | null;
  customBriefingPrompt: string | null;
  customWriterPrompt: string | null;
};
```

Chat duplication and export/import must preserve these settings. Removing a referenced connection does not silently change the stored selection; the UI reports the unavailable override and generation is blocked until it is changed or reset to the chat connection.

## Prompt Template Management

### Preset fields

Prompt presets gain two optional Conversation-mode templates alongside the existing template:

- `conversationPrompt` — used only by Standard Conversation generation.
- `conversationBriefingPrompt` — used as the first-pass curator system prompt.
- `conversationWriterPrompt` — used as the second-pass writer system prompt.

The Preset Editor will expose all three clearly labelled templates. Selecting a prompt preset for the chat selects the three associated Conversation templates together. Existing presets without the new fields remain fully valid for Standard generation.

Two-pass generation must not fall back to `conversationPrompt`. If either required two-pass template is missing or still unresolved, the UI and server block Two-pass generation with a specific configuration error. This prevents the regular prompt from being sent accidentally and breaking the isolation boundary.

### Chat-local overrides

Each two-pass prompt supports the same source hierarchy as the existing Conversation prompt:

1. chat-local override, when present;
2. selected prompt preset template;
3. bundled default two-pass template, once approved and supplied.

The regular `customSystemPrompt` remains the Standard Conversation override and is not reused for either two-pass prompt.

### Prompt placeholders

The prompt contents are deliberately unspecified here:

#### Conversation Briefing prompt

```text
[PLACEHOLDER — conversation context-curation prompt to be authored and approved separately]
```

#### Conversation Writer prompt

```text
[PLACEHOLDER — conversation response-writing prompt to be authored and approved separately]
```

The implementation must preserve these as independently editable templates. It must not substitute a hard-coded briefing structure, generic JSON contract, or generated prompt text without approval.

## Context and Prompt Boundaries

### Shared source resolution

The Two-pass pipeline reuses the existing services that resolve the current Conversation inputs. The first-pass input must include the context that would materially be available to Standard Conversation generation at the same message boundary, including when enabled or applicable:

- responding character identity and Conversation card fields;
- active persona identity and Conversation fields;
- the latest user input and resolved prompt attachments;
- automatic week/day summaries and the current logical-day transcript;
- Daily Conversation Memories retrieval;
- Daily Intentions;
- semantic Memory Recall;
- active lorebook context;
- current time, status, activity, schedules, and autonomous-message intent;
- cross-chat and explicitly connected-chat context;
- conversation-specific About Me and behaviour fields;
- generation guides and relevant hidden context messages;
- applicable pre-generation context-agent results; and
- group membership, response target, and character-specific visibility decisions.

Character Mind is not queried by CR032's first implementation. The source package must nevertheless be extensible so a future Character Mind briefing can be added without changing the writer boundary.

### Curator input construction

Two-pass generation must not depend on rendering the regular `conversationPrompt`, because that template is a response-writing template and may omit, relocate, or mix source context according to Standard-pipeline needs.

Instead, the server constructs a dedicated curator request from resolved source blocks with stable labels and source separation. The exact briefing structure remains controlled by `conversationBriefingPrompt`; Marinara only requires a non-empty bounded text result.

For individual group generation, the curator runs after the existing responder-specific audience filtering, lore scoping, current-context replacement, and character macro resolution. Each responding character therefore receives a separate curator call built from only the context available to that responder.

The first-pass call is hidden from the transcript. It uses the configured curator connection, its own output budget, the request abort signal, existing provider timeout and retry behaviour, and transport streaming where needed to avoid proxy timeouts. Curator tokens are not forwarded as visible chat tokens.

### Briefing handover

The first-pass result is an opaque Conversation Briefing string. Marinara trims it, applies the configured size bound, rejects an empty result, and records it as generation diagnostics. It does not parse or reinterpret a schema defined by the prompt.

The writer request is built from a new message array. It must not mutate, append to, or reuse the prepared curator/source messages.

The writer receives only:

1. the effective `conversationWriterPrompt`, including host-owned output and capability instructions required for the active Conversation features; and
2. the Conversation Briefing returned by the first call.

Provider tool definitions may continue to be supplied through the existing provider tool interface. They do not authorize copying the original Conversation context into writer messages. Any required character-command, group-output, timestamp, or response-format contract must be part of the writer system instructions rather than appended as a raw Standard-pipeline context block.

The initial implementation does not separately send a raw recent-message tail to the writer. Required conversational continuity must be carried by the Conversation Briefing. A separately configurable raw tail would weaken the isolation guarantee and requires a later design decision.

### Isolation invariant

The server must make it structurally impossible for the Two-pass writer builder to accept the Standard prompt message array. Tests must verify that text unique to cards, memories, summaries, lore, transcript history, and pre-generation injections appears in the writer request only when the curator includes it in the briefing.

## Relationship to the Existing Generation Lifecycle

The route continues to share the existing lifecycle before source-to-prompt conversion and after visible response generation:

```text
Shared request validation and chat loading
Shared context-source resolution
Shared agent/context preparation
            |
            +-- Standard: existing Conversation prompt -> response call
            |
            +-- Two-pass: curator request -> briefing -> isolated writer request -> response call
            |
Shared streaming, commands/tools, persistence, metadata, and post-processing
```

The Standard branch must remain byte-for-byte or semantically unchanged except for the new branch selection check and shared refactoring proven necessary to expose resolved source blocks.

The Two-pass branch should enter immediately before the existing main provider call, after responder-specific source resolution. After the writer request is constructed, it uses the existing provider-call, token-streaming, tool-loop, content cleanup, command parsing, message-save, swipe, and post-processing paths.

### Agents

- Managed context systems such as Daily Memories and Daily Intentions continue to resolve before the curator.
- Ordinary pre-generation context injections are curator sources, not direct writer injections.
- Prompt Patch agents cannot patch the isolated writer prompt. Their Standard-pipeline prompt-editing semantics are incompatible with Two-pass generation; the implementation must skip them for the Two-pass branch and surface that incompatibility in Chat Settings rather than silently applying a partial patch.
- Parallel and post-processing agents may continue through the existing lifecycle. Their results do not enter the writer request unless they already ran before curation and are explicitly part of the resolved curator source package.
- Existing post-processing text rewrites remain post-processing behaviour. They are not part of the two-pass context boundary and should be identified separately in generation diagnostics.

### Generation variants

- Normal Conversation messages use the selected pipeline.
- Autonomous Conversation messages use the selected pipeline and include their existing intent/current-context source data in the curator call.
- Regeneration/swipes use the selected pipeline at the target message boundary and run both passes again. Existing cached pre-generation context for that boundary remains reusable as curator source data.
- Individual group generation runs one curator/writer pair per responding character.
- Merged group generation runs one curator/writer pair for the merged response.
- Impersonation uses the selected pipeline with the persona as the response identity where the existing route supports it.
- Conversation turn-game bot turns that currently short-circuit normal Conversation generation remain on their dedicated runtime and do not use CR032.

## Diagnostics and Persistence

The existing generation debug and Peek Prompt surfaces must identify the active pipeline. For Two-pass generation they expose three read-only views:

1. curator input;
2. generated Conversation Briefing; and
3. writer input.

The briefing remains invisible in the chat transcript and is never stored as a chat message. It may be stored in the generated message's hidden generation metadata for debugging and reproducibility. That metadata must also record:

- pipeline identifier;
- curator provider/model and effective output limit;
- writer provider/model;
- separate first-pass and second-pass usage and duration when reported;
- effective prompt-source identifiers or hashes; and
- whether post-processing subsequently rewrote the writer result.

Normal non-debug UI need only show the active pipeline and progress stages. It must not display the briefing as character dialogue or a thought bubble.

## Failure and Cancellation

- Missing prompt templates, an unavailable curator connection, or invalid settings block generation before the first call.
- A curator timeout, provider failure, empty result, or abort stops the request without falling back to Standard generation and without saving an assistant message.
- A writer failure follows existing main-generation error handling.
- User cancellation aborts whichever pass is active and prevents the next pass from starting.
- A failed Two-pass attempt must never retry through `conversationPrompt`.
- Provider fallback and bounded transport retries may operate independently for the curator and writer according to their resolved connections.
- The existing send controls must not remain stuck after a first-pass failure.

## Data and Migration

- Chat pipeline selection and overrides are chat metadata; no chat-table migration is expected.
- Prompt presets require two new optional text fields and the corresponding file-backed/database storage migration used by existing prompt fields.
- Existing preset imports without these fields remain valid.
- Preset export/import includes the new fields when present.
- Bundled/default preset migration must preserve user-edited `conversationPrompt` and never copy it automatically into a two-pass prompt.
- Backup, chat duplication, and Marinara export/import preserve chat settings and preset fields through their existing metadata/preset paths.

## Security and Privacy

- The curator is intentionally allowed to receive the resolved Conversation context; selecting a different curator connection sends that context to that provider and must be clear in the connection setting.
- The writer receives only the curated briefing, reducing but not eliminating sensitive context sent to the writer provider.
- Source labels and wrapping must treat card, memory, summary, lore, and transcript contents as data rather than allowing embedded text to replace the curator's system instructions.
- Debug views and stored briefing metadata can contain sensitive conversation information and must follow existing prompt-debug access and export behaviour.

## Risks

- Context resolution is currently interleaved with Standard prompt assembly; extracting reusable source blocks could accidentally change the Standard branch.
- The briefing is deliberately lossy. A weak curator prompt or insufficient output budget may omit information required by the writer.
- Different curator and writer connections increase cost, latency, provider exposure, and failure modes.
- The curator model may not support attachments available to the chat model; existing caption/text fallbacks must remain available.
- Some agents assume they can patch the main prompt and are incompatible with the isolated writer boundary.
- Tool and command instructions must be reconstructed as writer-system requirements without leaking Standard context.
- Persisted briefings may increase message metadata size and expose sensitive derived context in exports or debug surfaces.
- Group generation multiplies the additional call by the number of responding characters.

## Acceptance Criteria

1. Conversation General Settings explicitly selects Standard or Two-pass generation and defaults to Standard.
2. Selecting Two-pass exposes curator connection, curator output budget, Briefing prompt, Writer prompt, and configuration status.
3. Switching pipelines does not delete or overwrite the inactive pipeline's prompt configuration.
4. Prompt presets store independent Standard Conversation, Conversation Briefing, and Conversation Writer templates.
5. The regular `conversationPrompt` and `customSystemPrompt` are not sent to either Two-pass call.
6. Missing Two-pass templates block generation; the server never falls back to the regular Conversation prompt.
7. The curator receives resolved context sources at the correct responder and message boundary.
8. The curator output remains invisible and is not stored as a transcript message or agent thought bubble.
9. The writer request is constructed afresh from the Writer prompt and Conversation Briefing, plus only host-owned technical capability contracts.
10. Tests prove that original cards, persona data, summaries, memories, transcript, lore, awareness, and agent injections cannot reach the writer except through briefing text.
11. Standard Conversation generation remains unchanged when selected.
12. Normal, autonomous, regenerate, group, and supported impersonation Conversation flows use the selected pipeline consistently; turn-game bot short-circuits remain unchanged.
13. Prompt Patch incompatibility is visible and cannot silently modify the Two-pass writer request.
14. Existing writer streaming, cancellation, tools, commands, message persistence, swipe handling, and post-processing continue to work.
15. Debug/Peek Prompt identifies the pipeline and exposes curator input, briefing, and writer input without rendering the briefing in chat.
16. Generation metadata separates curator and writer model, usage, duration, and prompt-source details.
17. Curator failure stops cleanly without a visible message or Standard-pipeline fallback.
18. Preset and chat export/import, duplication, and backup preserve the new configuration.
19. The two prompt bodies remain placeholders until separately supplied and approved.
