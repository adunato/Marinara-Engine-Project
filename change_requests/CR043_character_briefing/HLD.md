# CR043 — Character Briefing

_Status: Draft HLD_

## 1. Purpose

Introduce a character-owned Character Briefing: an editable, agent-maintained context document that captures higher-order, evolving story understanding such as relationships, current concerns, emotional/mental state, ongoing situations, and important developments.

The Character Briefing is additive to existing Marinara Conversation context generation. Existing mandatory and optional Conversation context behavior remains unchanged; the latest Character Briefing is injected as an additional context source for the responding character.

## 2. V1 Scope

V1 provides:

- one Character Briefing configuration per character;
- manual briefing generation only;
- an editor for the briefing template/instructions;
- storage and display of the latest generated briefing;
- read-only briefing-agent access to Character Cards, character-level Daily Memories, and Lorebooks;
- stable ID-backed entity references with autocomplete for Characters and Lorebooks;
- Conversation-time injection of the latest generated briefing as an additional context block.

V1 does not provide scheduled generation or briefing-history/version browsing.

## 3. Design Principles

### 3.1 Preserve existing Conversation behavior

The feature must build on top of current Marinara behavior rather than replace or suppress existing context assembly. Character Card, Persona, Conversation history/summaries, live Conversation context, and currently configured optional sources continue to be assembled normally.

The Character Briefing is deliberately additive even where limited semantic overlap exists. This minimises fork-specific prompt-pipeline divergence and reduces ongoing maintenance cost against upstream.

### 3.2 Character-owned, not chat-owned

The briefing belongs to a Character and must be generated independently of any particular Conversation. A character may participate in multiple chats, so briefing generation must operate against character-level evidence rather than an already-assembled chat prompt.

### 3.3 Agentic interpretation, selective retrieval

The briefing should focus on information that benefits from interpretation rather than deterministic prompt assembly: relationships, concerns, current state of mind, unresolved threads, and important story developments.

The agent should retrieve only evidence relevant to the user's briefing instructions. Large source collections must not be preloaded wholesale into every run.

### 3.4 User-controlled structure

The user owns the briefing structure. V1 must not impose a fixed schema for Relationships, Concerns, Current Situation, or similar sections. The user may write arbitrary Markdown-style text and instructions.

## 4. Briefing Document Syntax

The briefing editor supports three distinct concepts.

### 4.1 Deterministic macros — `{{...}}`

`{{...}}` represents deterministic Marinara values using the existing prompt-macro model where applicable. These are substitutions, not agent tasks.

### 4.2 Agent instructions — `[[...]]`

`[[...]]` identifies text that instructs the Character Briefing agent what understanding to develop or refresh.

Instructions should describe the desired result rather than retrieval mechanics. For example:

```markdown
[[Review my current relationship with $Amy and update the important recent developments, current dynamic, and unresolved issues.]]
```

The agent determines which of its available evidence tools are appropriate.

### 4.3 Entity references — provisional `$...`

The editor provides entity-reference autocomplete, initially for Characters and Lorebooks. A selected reference is persisted with a stable entity ID so duplicate or renamed display names do not force the agent to infer which entity was intended.

The exact serialized token format is an implementation detail to be finalised during LLD. It must remain text-persistable and recoverable in the V1 editor. A conceptual representation is:

```text
$[character:<id>|Amy]
$[lorebook:<id>|Asteria]
```

V1 does not require rich chip/pill rendering. A normal text editor with autocomplete and readable ID-backed tokens is sufficient.

## 5. Character Briefing Agent

### 5.1 Execution model

Briefing generation is an explicit manual action initiated by the user from the Character Briefing UI.

The agent receives:

- the owning Character ID;
- the current briefing template/document;
- the existing latest generated briefing where useful for continuity;
- current date/time where relevant;
- resolved stable entity references;
- a restricted read-only toolset.

The agent's purpose is to produce the next Character Briefing, not a conversational reply as the character.

### 5.2 Initial read-only evidence tools

V1 exposes only the evidence capabilities required for the first implementation.

#### Character Cards

The agent can retrieve Character Cards by stable Character ID and can search/list characters when needed. This allows it to contextualise the owning character and referenced characters without loading every card into the initial prompt.

The implementation should reuse existing Marinara structured character data-access services where practical rather than introducing a parallel storage/retrieval path.

#### Character Daily Memories

The agent can search and read the character-level Daily Memories introduced by CR042.

CR043 does not own or modify Daily Memory formation. It consumes the character-owned memory store created by CR042 as evidence. Retrieval should support selective relevant-memory access rather than preloading the complete memory corpus.

The exact read/search API should be aligned to the final CR042 implementation during implementation planning.

#### Lorebooks

The agent can identify Lorebooks, inspect their entry index, and retrieve selected entries in full. This allows briefing instructions to ask the agent to interpret canonical world information without automatically adding complete lorebooks to every briefing run.

Existing Marinara Lorebook data-access services should be reused where practical.

### 5.3 Tool boundaries

The Character Briefing agent must not receive Professor Mari's unrestricted/general application-data interface. Its V1 tool surface is read-only and narrowly scoped to Character Cards, Character Daily Memories, and Lorebooks.

## 6. Character Card UI

### 6.1 Location

Character Briefing is exposed as a dedicated tab in the existing Character Card UI.

The feature should feel like character metadata/context management, not a chat-level setting.

### 6.2 V1 layout

The tab contains two primary areas.

#### Briefing Editor

An editable Markdown-style text area containing the user's briefing structure, deterministic macros, agent instructions, and entity references.

Required editor behaviors:

- ordinary text/Markdown editing;
- support for `{{...}}` and `[[...]]` as plain text syntax;
- entity autocomplete using the chosen trigger character, provisionally `$`;
- autocomplete results grouped or otherwise clearly differentiated between Characters and Lorebooks;
- selection inserts an ID-backed persistent reference;
- normal keyboard editing remains possible without requiring a rich-text editor.

#### Latest Briefing

A read-only presentation of the most recently generated Character Briefing.

The latest result should be clearly separated from the editable briefing template so the user can distinguish:

- what the agent has been instructed to maintain; and
- the current generated briefing that will be supplied to Conversation generation.

V1 stores/displays only the latest generated briefing. A historical list of all previous briefing generations is out of scope.

### 6.3 Manual generation action

The tab provides a clear action such as **Generate Briefing** / **Update Briefing**.

On invocation:

1. the current editor content is persisted;
2. the Character Briefing agent runs using its restricted evidence tools;
3. the latest generated briefing is replaced on successful completion;
4. the UI displays the new latest briefing.

The existing latest briefing should remain available if generation fails.

### 6.4 Empty state

For a character with no generated briefing yet, the tab should show:

- the editor/template area;
- the manual generation action;
- a simple empty state in the Latest Briefing area explaining that no briefing has yet been generated.

## 7. Conversation Integration

When a Conversation response is generated for a character with a non-empty latest Character Briefing:

1. Marinara assembles the normal Conversation context using existing behavior;
2. the latest Character Briefing for the responding character is added as a distinct context block;
3. the normal generation flow continues unchanged.

The feature must not suppress or replace existing Character Card, Persona, summary/history, status/context, memory, lorebook, awareness, or other optional prompt sources.

For group Conversations, briefing injection must be character-specific: only the briefing(s) appropriate to the responding character(s) should be exposed according to the existing response-target/visibility model.

## 8. Persistence

V1 requires persisted character-level state for at least:

- briefing editor/template text;
- latest generated briefing text;
- latest generation timestamp/status as needed by the UI;
- any metadata required to preserve/resolve ID-backed entity references if that metadata is not fully encoded in the stored text.

The data belongs to the Character rather than to individual chats.

No historical briefing archive is required in V1.

## 9. Explicitly Out of Scope for V1

- scheduled or automatic briefing generation;
- startup catch-up scheduling;
- briefing generation triggered automatically by Conversation activity;
- history/version browser for prior generated briefings;
- rich-text entity chips as a requirement;
- unrestricted application-data access for the briefing agent;
- redesign of CR042 Daily Memory formation;
- replacement or suppression of existing Conversation context sources;
- fixed system-defined briefing sections/schema;
- chat-specific Character Briefings.

## 10. Reuse / Implementation Direction

Implementation planning should prefer existing Marinara primitives wherever possible:

- Character Card data access already used by Professor Mari and generation services;
- Lorebook list/index/entry retrieval already available through structured application-data services;
- existing Conversation `@mention`/completion interaction as a UI precedent for entity autocomplete;
- CR042's final character-owned Daily Memory storage/retrieval implementation for memory evidence;
- existing prompt/context injection mechanisms for adding a new character-specific context block without altering current source behavior.

The intent is to add one narrow character-level capability while minimising changes to core Conversation context assembly.

## 11. Open Implementation Questions

The following are intentionally deferred to implementation planning/LLD rather than treated as unresolved product scope:

- exact serialized syntax for ID-backed entity references;
- exact shared/reused editor autocomplete component structure;
- exact Character Daily Memory query/read interface after CR042 is finalised;
- whether the agent updates the entire briefing in one generation or uses an internal multi-step/tool loop before returning one final document;
- precise context-block formatting and insertion point for the latest briefing;
- persistence schema/location within the Character model versus a dedicated associated record.

## 12. Acceptance Summary

CR043 V1 is complete when a user can open a Character Card, select the Character Briefing tab, edit a free-form briefing template containing `{{...}}`, `[[...]]`, and ID-backed Character/Lorebook references, manually generate a briefing using read-only Character Card, CR042 Daily Memory, and Lorebook evidence, see the latest generated briefing in the same tab, and have that latest briefing automatically included as additional context when Marinara generates a Conversation response for that character — without changing existing Conversation context behavior.