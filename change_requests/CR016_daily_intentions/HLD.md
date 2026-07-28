# CR016: Daily Intentions

Status: Proposed — awaiting HLD approval

## Goals

- Add a built-in Conversation agent that turns comprehensive character context into a focused set of first-person intentions for the current day.
- Counter the reactive bias of roleplay generation by giving the character plausible initiatives that can move relationships and plotlines forward without predetermining outcomes.
- Keep the output grounded in the character's current situation, emotions, desires, conflicts, and commitments while making future intent the dominant focus.
- Give each eligible Conversation its own editable intention-area headings and prompts.
- Let users manually generate all enabled areas or one area at a time, inspect the current result, and edit it directly.
- Inject the current enabled intentions into normal Conversation context until they are successfully replaced.
- Follow the Daily Conversation Memories interaction model where it fits while keeping Daily Intentions independently configured and stored.

## Non-Goals

- Multi-character Conversation support.
- Automatic, scheduled, startup catch-up, or cutoff-triggered generation.
- Historical Daily Intentions, missed-day backfill, or access to previous days.
- A coherence, emotional-lens, relationship-lens, or other synthesis pass.
- Dynamically adding, removing, or reordering intention areas.
- A shared user-editable base prompt.
- Treating intentions as factual memories, completed events, or a rigid daily schedule.

## Product Model

Daily Intentions is a built-in, opt-in Conversation agent for chats containing exactly one character. It maintains one current set of character intentions divided across four fixed, ordered areas:

1. Work or Study
2. Friendships
3. Romance
4. Sex

Each area has a stable internal key, an editable display heading, an editable prompt, an enabled state, and one current free-text output. Users may rename or disable an area, but may not add, remove, or reorder areas in this iteration.

The output is derived, temporary cognitive state. It expresses what the character currently understands, feels, wants, and intends to do next. It is not memory and must not be interpreted as evidence that an intended action occurred.

## Eligibility

- The agent is available only in Conversation mode.
- Generation and context injection require the Conversation to contain exactly one character participant.
- Multi-character Conversations do not expose a usable Daily Intentions runtime and must explain that the feature currently supports single-character chats only.
- If an enabled Conversation later becomes multi-character, preserve its configuration and current outputs but stop generation and injection until it is eligible again.
- The user persona is not counted as a character participant.

## Per-Conversation Configuration

Daily Intentions configuration must be genuinely Conversation-scoped. The existing Daily Memories UI is a useful interaction precedent, but its shared built-in agent configuration record is not sufficient for character-specific headings and prompts.

Each eligible Conversation stores:

- Whether the Daily Intentions agent is active through the existing chat-agent activation model.
- The language-model connection used for intention generation, following existing agent connection and fallback behavior.
- A configurable daily cutoff or handover time.
- The four fixed area records, each containing its heading, prompt, and enabled state.

The cutoff is intentionally informational/reserved in this iteration. It is visible and editable in the UI but performs no scheduling, eligibility check, invalidation, expiry, or automatic execution. The UI must make the manual-only behavior clear rather than implying that the cutoff currently triggers a run.

Each area prompt is self-contained and editable. There is no shared editable base prompt. A minimal application-controlled wrapper may delimit the supplied context and identify the target character and area, but all behavioral generation instructions belong to the selected area's prompt.

Default prompts should independently instruct the model to:

- Write one short-to-medium paragraph in the character's first person.
- Briefly ground the intention in the current situation and emotional position.
- Put most of the emphasis on what the character wants, decides, plans, watches for, initiates, resists, reveals, explores, or leaves conditionally open during the day.
- Prefer plausible initiative over waiting passively for the user or another character to act.
- Express initiatives rather than guaranteed outcomes or control over another person's response.
- Preserve uncertainty, ambivalence, avoidance, restraint, or a decision to observe when those are authentic to the context.
- Avoid inventing events, conversations, or decisions that have already happened.
- Return only the area's free-text paragraph without a heading, analysis, bullets, or structured data.

The area-specific defaults then tailor attention to work/study responsibilities and ambitions, friendships and social tensions, romantic attachment and relationship movement, or sexual feelings, boundaries, desires, and intentions respectively. Output length remains prompt-controlled rather than a separate hard-coded setting.

## Context Input

Every area run receives a comprehensive snapshot of the context normally available to the eligible Conversation at that moment, subject to the application's existing context budgets and enabled sources. This includes applicable character and persona information, current Conversation history, summaries, Daily Memories, recalled memories, lore/context sources, schedules, and other established Conversation context.

The generation path must:

- Explicitly exclude the current or previous Daily Intentions section from its input.
- Distinguish intended actions from memories and events in the remaining sources.
- Use the same immutable context snapshot for every area in one Run All operation.
- Never pass a newly generated area's output into a later area's input.

Excluding previous intentions forces each run to reassess the character from what actually happened and what is currently known rather than paraphrasing an earlier plan.

## Manual Generation

The feature has no automatic execution in this iteration.

### Run All

- Process enabled areas sequentially in their fixed order.
- Treat each area as an independent operation, with its own prompt and the shared initial context snapshot.
- Persist each successful output immediately and refresh that area in the UI before starting or reporting the next result.
- If an area fails, retain its previous output, display the failure, and continue processing the remaining enabled areas.
- A failed area with no previous output remains empty and can be run individually.
- Do not roll back successful areas because another area failed.
- Prevent overlapping runs that could overwrite the same area unpredictably.

### Run One Area

- Generate only the selected enabled area using its current prompt and a fresh comprehensive context snapshot.
- On success, replace only that area's current output.
- On failure, preserve its previous output.

There is no coherence pass after either execution mode.

## Persistence and Replacement

- Persist only one current output per area per Conversation.
- Successful generation replaces that area's previous output; no historical copy remains viewable.
- Manual edits replace the saved current text for the affected area.
- If no new generation occurs, current intentions remain valid, visible, and injectable indefinitely.
- Do not expire or disable intentions at the configured cutoff.
- Disabling an area removes it from generation and context injection but preserves its configuration and last output for possible re-enablement.
- Persist operational metadata needed for safe updates and UI feedback, such as per-area update time and generation state or error data where appropriate, without creating a user-facing history.

## Conversation UI

Use the Daily Memories editor and Conversation settings integration as the primary visual and interaction reference.

### Agent Settings

When Daily Intentions is active for an eligible Conversation, its settings expose:

- Generation connection.
- Informational/reserved cutoff time with a clear manual-only explanation.
- The four fixed areas in fixed order.
- Per-area enable/disable control.
- Editable per-area heading.
- Editable per-area prompt with reset-to-default behavior.

The settings drawer may route to a focused modal for the four paragraph-sized prompts so the normal drawer remains compact.

### Current Daily Intentions

Add a dedicated Daily Intentions entry in Conversation settings that opens a wide editor modal. The modal shows only the current output and includes:

- One clearly separated card or section for each enabled area in fixed order.
- The configured heading and an editable paragraph textarea.
- A Run/Re-run action for each area.
- A top-level Run/Re-run All action.
- Save and Cancel behavior for manual text edits.
- Per-area progress, success, empty, and error states.
- Immediate UI replacement as each area succeeds during Run All.
- Clear preservation of the previous value when a run fails.

Rerunning an area with unsaved manual edits must not silently discard them. Use the existing destructive-regeneration confirmation style where necessary. No manual-edit indicator is required.

## Prompt Context Injection

When the agent is active, the Conversation is eligible, and saved outputs exist, inject one explicitly delimited `Daily Intentions` section into normal character generation context. It contains the enabled areas in fixed order using their current configured headings and saved first-person prose.

- Omit disabled areas and enabled areas that have no saved output.
- Continue injecting older successful values when a newer manual run has not occurred or has failed.
- Keep the section distinct from summaries, factual memories, schedules, and ordinary transcript content.
- Identify the single character clearly so first-person text cannot be mistaken for the user persona's intentions.
- Never feed this injected section back into Daily Intentions generation.

## Failure Behavior

- A missing or invalid generation connection prevents the requested area from updating but does not affect ordinary Conversation generation.
- Empty or invalid model output is an area failure and preserves the previous saved value.
- A partial Run All remains partial: successes persist, failures remain retryable, and later areas still run.
- Context-injection failures degrade safely by omitting Daily Intentions rather than blocking a chat response.
- Disabling the agent or making the chat ineligible preserves stored configuration and outputs.

## Risks

- Proactivity instructions may push a character toward implausible action or excessive drama if defaults are too forceful.
- Independently generated areas can overlap or conflict because the design deliberately omits a coherence pass.
- Partial runs can temporarily combine newly generated areas with older retained areas.
- Persisted intentions can become stale because they do not expire and scheduling is out of scope.
- Comprehensive context replicated across four calls can be expensive in tokens and provider usage.
- Context sources can contain plans that never occurred; prompts must avoid converting them into facts.
- A visible but inactive cutoff may confuse users unless its reserved/manual-only status is explicit.
- Storing character-specific settings in the shared agent configuration would leak configuration across chats; persistence must remain Conversation-scoped.

## Validation

- Verify the agent is usable in a one-character Conversation and unavailable for multi-character Conversations.
- Verify adding a second character stops generation and injection without deleting existing configuration or output.
- Verify the four areas retain fixed order, cannot be added/removed/reordered, and support rename, prompt editing, reset, and disabling.
- Verify the cutoff is persisted and displayed but causes no timer, startup catch-up, cutoff check, expiry, or automatic generation.
- Verify Run All uses one shared context snapshot, executes enabled areas sequentially, updates each success immediately, continues after failure, and preserves failed areas' previous outputs.
- Verify a single-area rerun changes only that area.
- Verify previous Daily Intentions and earlier results in the same Run All are absent from every area input.
- Verify first-person, free-text output and area-specific prompts are passed without a shared editable base prompt.
- Verify manual edits persist and unsaved edits are protected from accidental regeneration.
- Verify only current outputs are stored and no prior-day history or backfill UI exists.
- Verify disabled and empty areas are omitted from context while older successful enabled outputs remain injected after failed or absent reruns.
- Verify Daily Intentions is explicitly delimited from summaries, Daily Memories, recalled memories, schedules, and transcript content.
- Verify persistence across server restart and safe degradation for missing connections, invalid model output, storage errors, and context-injection errors.
- Run schema verification if persistence changes require it, `pnpm check` for the cross-cutting implementation, and focused Playwright E2E only after agreeing the validation scope with the user.
