# CR019: Compiled Character Mind

Status: Proposed

## Problem

Conversation characters currently receive authored character-card context, summaries, recent messages, Memory Recall, Daily Memories, and optional Daily Intentions. These sources help the model reconstruct a character's state, but Marinara does not preserve the character's evolving subjective interpretation of their life.

Daily Intentions derives current first-person plans as free text. Extending that feature into longer-lived prose would still leave the model reconstructing and rewriting an undifferentiated summary. It would not provide independently addressable beliefs, emotional associations, relationship attitudes, evidence, or explicit change over time.

CR019 adds a small Marinara-native compiled mind. It treats the character card and Daily Memories as source material, incrementally maintains structured concepts and mental associations, activates the relevant subset for the current situation, and performs one transient appraisal before the normal reply is written.

## Goals

- Give a single Conversation character an inspectable, persistent subjective model derived from their character card and saved Daily Memories.
- Keep immutable source evidence separate from the compiled model.
- Represent the mind as small concepts plus independently updateable mental associations rather than regenerated prose sections.
- Preserve provenance from each association to the character card or supporting and contradicting Daily Memories.
- Update associations through explicit create, reinforce, weaken, revise, and supersede operations.
- Preserve compatible and conflicting attitudes without forcing every contradiction into one resolved statement.
- Activate only associations relevant to the current Conversation situation.
- Produce a transient current appraisal that informs, but does not write, the character's reply.
- Reuse Marinara's file-native storage, agent connections, embeddings, Daily Memory lifecycle, prompt assembly, and Conversation settings patterns.
- Keep the first implementation understandable and usable inside Marinara rather than building a generic memory platform.

## Non-Goals

- A general-purpose ontology, knowledge-graph engine, graph database, or reusable enterprise agent-memory service.
- Literal Markdown or Obsidian storage. The source/compiled/schema lifecycle is useful; the file format is not required.
- Multi-character Conversations, Roleplay, Game Mode, shared character-card minds, or cross-chat mind merging.
- Automatically changing the authored character card.
- Replacing Daily Memories, automatic summaries, Memory Recall, Daily Intentions, or recent transcript context.
- Treating a current appraisal, generated reply, or previous model synthesis as new evidence.
- A clinical, scientifically complete, or diagnostically meaningful model of human psychology.
- User-defined concept types, association kinds, inference rules, or schema scripting in the first release.
- Autonomous external research, tools, or world-state mutation.

## Product Scope

Compiled Character Mind is an opt-in managed agent for Conversation chats containing exactly one character. The persisted model belongs to the tuple of Conversation and character, not to the reusable character card globally. This prevents alternate chats, personas, and timelines from contaminating one another.

The agent can use already persisted Daily Memories even if the Daily Conversation Memories agent is later disabled. It can only learn automatically from new days when Daily Memories continue to be formed.

When the chat becomes ineligible, Marinara preserves the compiled model but stops consolidation, appraisal, and prompt injection until the Conversation again contains exactly one character.

## Structural Model

CR019 follows a compact version of the source/compiled/schema lifecycle:

1. **Sources** are the immutable authored character card and saved Daily Memories.
2. **Compiled mind** is the persisted set of concepts and mental associations.
3. **Schema** is a fixed application-owned grammar and the prompts and validation rules that maintain it.
4. **Ingest** is daily consolidation after new Daily Memory days become available.
5. **Query** is activation plus transient appraisal before a reply.
6. **Lint** is bounded reorganization that merges duplication, repairs links, identifies stale or unsupported associations, and preserves unresolved conflicts.

Marinara stores this model as one bounded structured document per Conversation and character in its existing file-native database. It may expose a wiki-like concept browser, but it does not introduce a filesystem wiki, normalized graph schema, or another database.

## Fixed Grammar

### Concepts

A concept is an addressable subject in the character's mind. The first release supports a small fixed set:

- `self`
- `person`
- `relationship`
- `life_area`
- `situation`
- `theme`

Each concept has a stable identifier, type, short title, optional concise orientation text, and created/updated timestamps. Conversation and character ownership come from the containing mind document.

Concept creation should remain conservative. A new proper noun or passing topic does not automatically deserve its own concept. The consolidation prompt should create concepts only when the subject is likely to matter again.

### Mental Associations

An association is one independently addressable piece of subjective state attached to a source concept and optionally related to another concept. Supported kinds are:

- `belief`
- `expectation`
- `feeling`
- `relationship_stance`
- `self_view`
- `value`
- `motivation`
- `concern`

Each association in the containing mind document stores:

- stable identifier and owning concept;
- optional related concept;
- kind and concise natural-language content;
- strength from 1 through 5;
- confidence from 1 through 5;
- active or superseded state;
- source references to character-card fields and Daily Memory IDs;
- supporting and contradicting evidence references where applicable;
- first-formed and last-updated timestamps;
- optional embedding for activation.

Strength represents how psychologically influential the association is. Confidence represents how certain the character is of belief-like content. Feelings and values may use confidence as stability or settledness rather than factual certainty; the prompt and UI must describe this distinction plainly.

Opposing associations may remain active simultaneously. Ambivalence is represented by multiple evidence-grounded associations and optional `conflicts_with` links, not by forcing a single blended conclusion.

## Consolidation

Consolidation runs after one or more newly formed Daily Memory days are available and before normal Conversation generation. It is bounded so a backlog cannot indefinitely delay a reply.

The consolidation model receives:

- relevant character-card fields as authored priors;
- the new Daily Memories with IDs, dates, importance, and exact stored text;
- the concepts and associations most relevant to those memories;
- a compact index of the remaining active concepts so it can reuse existing identities.

It returns structured proposed operations rather than a rewritten complete mind:

- create a concept or association;
- reinforce an association with new supporting evidence;
- weaken an association with contradicting evidence;
- revise wording without losing identity or evidence;
- supersede an association with a replacement;
- link or unlink related or conflicting concepts/associations.

The server validates operation types, identifiers, bounds, ownership, source references, and per-run limits before applying them to an in-memory copy and atomically replacing the stored document. Reinforcement and weakening use bounded application-controlled changes; the LLM does not freely assign arbitrary accumulated strength after every day.

An update may validly make no durable change. Low-value routine memories should not create model churn.

The last successfully processed Daily Memory day is recorded. Failed consolidation leaves the existing model and cursor unchanged so the day can be retried.

## Reorganization

Daily consolidation may perform small local cleanup around affected concepts. A separate user-triggered **Reorganize** action performs a broader maintenance pass that can:

- merge duplicate concepts or associations;
- repair missing links;
- identify unsupported or stale associations;
- supersede obsolete wording;
- preserve unresolved contradictions;
- recommend removal of low-value inactive material.

Reorganization remains a bounded LLM-assisted maintenance operation, not an always-running scheduler. It cannot modify source Daily Memories or the character card.

## Activation and Appraisal

For each eligible reply while the agent is active:

1. Marinara builds a query from the current eligible Conversation messages.
2. It seeds activation through semantic similarity and direct concept references.
3. It selects a bounded set of active associations using relevance, strength, confidence, Daily Memory importance where available, and recency.
4. It may include directly linked concepts or conflicting associations in one limited expansion so context includes meaningful tensions rather than only the highest-scoring isolated statement.
5. A dedicated appraisal call receives the character card, current situation, and activated model subset.

The appraisal call returns a compact structured internal result covering:

- interpretation of the current situation;
- active feelings;
- relevant expectations or sensitivities;
- impulses and restraints;
- unresolved tension when present.

The appraisal must not write dialogue, assert that intended actions occurred, or alter persistent state. Marinara injects it into the normal Conversation prompt as a clearly delimited character-specific section and then performs the ordinary response generation.

Activation may return no associations, and appraisal may validly be omitted. Any retrieval or appraisal failure is fail-open and must not block the reply.

## Relationship to Existing Features

- **Daily Memories** remain the primary event evidence and are never rewritten by CR019.
- **Character cards** remain authored identity and behavioural authority. Compiled associations cannot silently edit them.
- **Daily Intentions** remain current prospective intentions. CR019 does not rewrite or schedule Daily Intentions in the first release.
- **Automatic summaries** remain chronological compression rather than subjective state.
- **Memory Recall** continues to retrieve past transcript fragments independently.
- **Cross-chat awareness** does not merge or mutate the Conversation-scoped mind.

Prompt sections must identify these sources distinctly so the response model cannot mistake an appraisal for an event, a belief for an objective fact, or an intention for a completed action.

## Configuration and UI

The first release keeps configuration deliberately small:

- enable or disable the managed agent through existing Conversation Agents controls;
- select one model connection used for consolidation, reorganization, and appraisal;
- inspect the current compiled mind;
- manually edit or remove concepts and associations;
- view strength, confidence, status, and source-memory references;
- generate missing initial state from existing sources;
- rebuild the entire compiled mind from the current character card and all saved Daily Memories after explicit confirmation;
- run Reorganize manually;
- preview the currently activated subset and appraisal for the Conversation context.

There is no visual graph editor, ontology designer, rule builder, or large set of ranking controls. A searchable concept list with association cards is sufficient.

Manual edits update compiled state but do not fabricate source evidence. The UI marks user-authored edits explicitly and allows them to exist without Daily Memory provenance.

## Persistence

Use one dedicated file-native `character_minds` row per eligible Conversation and character. The row stores:

- the bounded JSON mind document containing concepts, associations, links, evidence references, and optional stored embeddings;
- the Daily Memory source cursor or compact source fingerprint used to find changed evidence;
- created, updated, and last-consolidated timestamps.

The collection is intentionally small enough for direct in-process filtering and scoring. CR019 does not add a graph database, join tables, a general query language, background workers, or a separately deployed service.

The table participates in normal chat and character cascade behavior. Deleting a Conversation deletes its compiled mind. Removing the agent preserves the model unless the user explicitly chooses to clear it, matching the preservation behaviour of Daily Intentions.

## Failure Behaviour

- Missing or invalid model connections skip consolidation or appraisal without blocking chat.
- Invalid structured output applies no partial state mutation.
- A failed daily consolidation does not advance its cursor.
- A failed rebuild preserves the previous complete model.
- A failed appraisal omits only the appraisal block.
- Missing embeddings fall back to a bounded textual/direct-concept path where practical; they do not trigger a separate infrastructure requirement.
- Concurrent consolidation, rebuild, edit, and reorganization operations for one mind are serialized or rejected clearly.
- Removing source Daily Memories does not silently erase associations during reply generation; the next consolidation, rebuild, or reorganization identifies unsupported references.

## Risks

- LLM interpretation may manufacture certainty or attribute another participant's statement to the character.
- Repeated consolidation may reinforce an early mistaken interpretation.
- The additional appraisal call increases response latency and model cost.
- Too many weak concepts or associations may create noisy activation and prompt bloat.
- Too aggressive supersession may flatten ambivalence; too little cleanup may leave contradictory clutter.
- Daily Memories may omit tone, uncertainty, speaker attribution, or exact wording needed for a sound psychological update.
- Editing and rebuild operations may surprise users if source provenance and destructive replacement are not clear.

Mitigations are fixed ownership and attribution rules, source references, bounded operations, explicit confidence, preserved contradictions, inspectable state, transactional updates, and fail-open runtime behaviour.

The stored document has application-defined size and item-count limits. When it approaches those bounds, consolidation must revise, merge, supersede, or decline low-value additions rather than expanding without limit.

## Validation

- Verify single-character Conversation eligibility and isolation between Conversations using the same character card.
- Verify card-derived priors are distinguishable from Daily Memory evidence and never alter the card.
- Verify create, reinforce, weaken, revise, supersede, related-link, and conflict-link operations with bounded deterministic state changes.
- Verify invalid IDs, cross-chat references, invalid strengths/confidence, unknown operation kinds, and malformed structured output produce no partial mutation.
- Verify supporting and contradicting evidence remain traceable to existing Daily Memory IDs.
- Verify opposing associations can coexist and both activate for an appropriate situation.
- Verify activation uses current context and returns a bounded relevant subset with directly related conflicts.
- Verify appraisal is transient, character-specific, clearly delimited, and excluded from consolidation input.
- Verify appraisal and consolidation failures do not block ordinary replies or destroy prior state.
- Verify initial build, manual edit/delete, rebuild confirmation, failed rebuild preservation, Reorganize, clear, and preview behaviour.
- Verify deleting a chat cascades its compiled mind and disabling/removing the agent preserves it.
- Run `pnpm db:push` for the new schema and `pnpm check` once for the substantive cross-cutting change.
- After implementation is complete, agree with the user whether to add focused CR019 Playwright E2E validation.
