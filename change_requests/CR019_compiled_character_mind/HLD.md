# CR019: Compiled Character Mind

Status: Proposed

## Problem

Conversation characters receive a character card, summaries, recent messages, recalled transcript fragments, Daily Memories, and optional Daily Intentions. The response model must still reconstruct the character's current subjective understanding from those sources on every reply.

CR019 tests a narrower idea: compile the character's accumulated understanding into a small, maintained set of linked pages, then retrieve the relevant pages before each reply. It deliberately does not attempt to define a complete psychology or pre-classify beliefs, feelings, relationships, motives, and other mental phenomena.

## Outcome

When the feature works, a significant Daily Memory updates one or more persistent subject pages. A later analogous situation retrieves those pages and uses them to form a short current appraisal before the ordinary response is written.

The user can inspect the compiled pages and see which character-card fields or Daily Memories contributed to them.

## Scope

- Opt-in managed agent.
- Conversation mode only.
- Exactly one character in the Conversation.
- One mind per Conversation and character, so alternate chats and timelines remain isolated.
- Character card and persisted Daily Memories are the only compilation sources in the first release.
- One configured model connection is used for both compilation and appraisal.

The feature may read existing Daily Memories even when the Daily Conversation Memories agent is no longer active. It can only receive new experience automatically when new Daily Memories are formed.

## Non-Goals

- A graph database, ontology, generic memory framework, or enterprise knowledge service.
- Fixed psychological categories or numeric models of belief, confidence, emotion, salience, or personality.
- Multi-character, Roleplay, Game, cross-chat, or globally shared character minds.
- Replacing or modifying the character card, Daily Memories, summaries, Memory Recall, or Daily Intentions.
- Scheduled background workers, autonomous research, graph visualization, schema editors, or user-authored inference rules.
- Automatically treating an appraisal or generated reply as durable evidence.

## Structural Pattern

CR019 uses the useful part of the LLM-wiki pattern:

1. **Sources:** immutable character-card fields and Daily Memories.
2. **Compiled artifact:** a bounded set of linked mind pages.
3. **Schema:** the single page shape and the compilation/appraisal prompts.
4. **Ingest:** update affected pages when a new Daily Memory day is available.
5. **Query:** retrieve relevant pages for the current Conversation context.

There is no separate lint or reorganization subsystem in the first release. Rebuild is the recovery mechanism if the compiled artifact drifts or becomes cluttered.

## Complete Data Schema

The semantic model has one primitive: `MindPage`.

```ts
type MindSourceRef =
  | { type: "character_card"; field: string }
  | { type: "daily_memory"; id: string };

type MindPage = {
  key: string;
  title: string;
  content: string;
  linkKeys: string[];
  sources: MindSourceRef[];
  embedding: number[] | null;
  createdAt: string;
  updatedAt: string;
};

type CharacterMindDocument = {
  version: 1;
  characterId: string;
  characterCardRevision: string;
  dailyMemoryRevisions: Record<string, string>; // date -> deterministic revision
  pages: MindPage[];
};
```

The file-native `character_minds` table contains one row per Conversation and character:

```ts
type CharacterMindRow = {
  id: string;
  chatId: string;
  characterId: string;
  document: string; // JSON-serialized CharacterMindDocument
  createdAt: string;
  updatedAt: string;
};
```

`chatId + characterId` is unique. Chat deletion cascades to the row.

### Page meaning

A page represents one reusable subject that may affect future interpretation: a person, relationship, part of the character's life, recurring concern, self-understanding, or any other subject that proves useful. These are examples, not schema categories.

`key` is a stable, validated slug used for identity and linking. `title` names the subject. `content` is a concise current synthesis of what that subject means to this character. It may include facts, feelings, expectations, uncertainty, or contradiction in ordinary language. `linkKeys` connect subjects that are useful to consider together. Link semantics remain in the page content rather than a fixed relationship vocabulary.

`sources` records provenance. It does not imply that every sentence can be mechanically attributed to one source; it identifies the material used to maintain the page. When a union would exceed the source limit, Marinara retains every character-card reference and the most recently updated Daily Memory references.

Pages are deliberately small and bounded. Initial hard limits will be centralized constants rather than user settings:

- at most 30 pages per mind;
- at most 1,500 characters of content per page;
- at most 10 links and 50 source references per page.

These limits exist only to bound storage, compilation context, and response context. They can be recalibrated after observing real minds.

## Page Creation Rule

Create a page only when all of the following are true:

1. The subject is likely to matter in future conversations.
2. The character has developed a subjective understanding or association worth preserving.
3. The information cannot be left solely as an episodic Daily Memory without requiring future reconstruction.

Routine events, isolated facts, and passing topics remain Daily Memories. A compilation run may validly change nothing.

## Compilation

Compilation processes one completed Daily Memory day at a time. It receives:

- the authored character card;
- every Daily Memory from that day, including ID, date, importance, and exact text;
- an index of existing page keys and titles;
- the eight existing pages with the highest semantic similarity to that day's memories at or above cosine similarity `0.25`.

The model returns only page upserts:

```ts
type MindPageUpsert = {
  key: string; // creates when absent; updates when present
  title: string;
  content: string;
  linkKeys: string[];
  sourceMemoryIds: string[];
  sourceCardFields: string[];
};

type MindCompilationResult = {
  upserts: MindPageUpsert[];
};
```

The server validates that:

- keys use the application slug format and are unique within the mind;
- link keys exist or are created in the same batch;
- an existing page can be updated only when its complete prior content was supplied to the compiler;
- Daily Memory IDs and card fields came from the supplied source set;
- titles are unique case-insensitively;
- page and document limits are respected.

For an existing page, the upsert replaces `title`, `content`, and `linkKeys`; source references are unioned with existing references. Changed pages receive fresh embeddings. The server applies the complete batch to an in-memory copy and replaces the stored document only when the entire result is valid.

The compiler receives the remaining page capacity. At the 30-page limit it may update supplied pages but cannot create another page. An attempted over-limit creation rejects the batch rather than silently deleting existing state.

There are no reinforce, weaken, supersede, confidence, or strength operations. If new evidence changes the character's understanding, the model rewrites the affected page while retaining its stable key and accumulated provenance. Conflicting attitudes are written plainly in the same page or separated into linked pages when they concern independently reusable subjects.

`characterCardRevision` is a deterministic hash of the supplied card fields. `dailyMemoryRevisions` stores one deterministic revision per completed day using the ordered Daily Memory IDs and update timestamps. Comparing these values identifies the oldest new or changed day for automatic compilation.

A character-card change or removal of previously compiled Daily Memory evidence marks the mind as needing rebuild; the editor shows that state and pauses automatic day compilation. The current card still participates in appraisal, but CR019 does not attempt to reverse arbitrary old synthesis automatically. A new or edited Daily Memory day is safe to process incrementally and receives its new revision only after a successful document replacement.

### Initial build and rebuild

The editor exposes **Build mind** when no document exists and **Rebuild mind** afterward. Build/rebuild starts with one card-only compilation call, then processes existing Daily Memory days through the same page-upsert path, showing progress. Rebuild constructs a complete candidate document separately and replaces the old document only after success.

Routine automatic consolidation processes at most one newly changed completed day before a reply. Additional backlog waits for later replies so the feature cannot hold a chat request indefinitely.

## Retrieval

The current retrieval query is the existing eligible last six Conversation messages, matching the Daily Memories default rather than adding another setting.

Marinara embeds that query and ranks pages solely by cosine similarity to their stored embeddings. It selects the five highest-scoring pages at or above the existing Memory Recall cosine threshold of `0.25`, then follows their links in query-score order until reaching a hard maximum of eight pages.

There is no confidence, importance, recency, or hand-written psychological weighting in the first release. Those mechanisms should be added only if observed retrieval failures justify them.

If embeddings are unavailable, Marinara falls back to case-insensitive title matching against the current context. If no page matches, appraisal is skipped.

## Appraisal

The appraisal call receives:

- the character card;
- the selected mind pages;
- the same recent Conversation messages used for retrieval.

It returns one field:

```ts
type CharacterMindAppraisal = {
  appraisal: string;
};
```

The prompt asks for one concise internal account of how the current situation lands for the character, including relevant interpretation, emotion, tension, or impulse only when supported by the supplied pages and current context.

The appraisal is injected into normal Conversation generation in a clearly delimited character-specific block. It is never stored, never supplied to compilation, and never treated as an event. It must not contain final dialogue or claim that an action occurred.

Compilation, retrieval, or appraisal failure omits the mind contribution and allows the ordinary reply to continue.

## Minimal UI

Conversation Agents settings provide:

- agent enablement;
- one connection selector;
- an entry point to **Character Mind**.

The Character Mind modal provides:

- build/rebuild and clear actions;
- a list of pages showing title, editable content, linked page titles, and source references;
- save and delete for individual pages;
- build/rebuild progress and ordinary loading, empty, and error states.

There is no graph view, automatic reorganization control, appraisal preview, ranking configuration, page-type selector, confidence control, or strength control.

Manual pages use an empty `sources` array. Routine compilation may update them only when they are returned as relevant context and the new source material genuinely changes them.

Deleting a page removes its key from every remaining page's `linkKeys`. Renaming a title does not change its stable key.

## End-to-End Processing Trace

1. Daily Memory day `D` has a revision not present in `dailyMemoryRevisions`.
2. Marinara sends day `D`, the card, the page index, and semantically relevant existing pages to the compiler.
3. The compiler returns zero or more keyed page upserts.
4. Marinara validates the complete result, applies it to a copy, refreshes changed embeddings, stores the document, and records the revision for `D`.
5. On a later reply, the last six messages retrieve five pages by embedding and up to three linked pages.
6. The appraisal model converts only that current context, card, and selected page set into one transient appraisal paragraph.
7. Normal Conversation generation receives the appraisal. Nothing from steps 6 or 7 is written back to the mind.

## Relationship to Existing Features

- Daily Memories remain episodic evidence and are never modified.
- The character card remains authored identity and is never modified.
- Daily Intentions remain current prospective plans and are not changed by CR019.
- Summaries, Memory Recall, and cross-chat awareness remain independent prompt sources.
- Removing or disabling the agent preserves the mind document; explicit clear or chat deletion removes it.

## Risks

- Page prose may manufacture certainty or misattribute another participant's statement.
- Rewriting a page may lose nuance even though provenance remains.
- Untyped links may be less precise than a future domain grammar.
- The additional appraisal call increases latency and model cost.
- Daily Memories may omit tone, attribution, or uncertainty needed for a sound synthesis.
- A 30-page cap may eventually be too small or too large.

These are accepted first-release tradeoffs. The page model should be expanded only in response to demonstrated failures--for example, adding atomic claims only if page rewriting loses important contradictions, or typed links only if untyped traversal retrieves the wrong context.

## Validation

- Verify one mind per Conversation and character, including isolation between chats using the same card.
- Verify schema normalization and all page, link, source, and document bounds.
- Verify keyed page creation, existing-page replacement, source union, link validation, and atomic rejection of an invalid batch.
- Verify a low-value day may return no upserts.
- Verify per-day revisions identify new and edited Daily Memory days, while card changes and removed evidence mark the mind for rebuild.
- Verify build/rebuild uses the same day compilation path and failed rebuild preserves the old document.
- Verify retrieval selects semantic matches, follows only bounded links, and falls back to title matching without embeddings.
- Verify appraisal is transient, delimited, excluded from future compilation, and cannot block ordinary generation.
- Verify manual page editing/deletion, clear, agent removal preservation, and chat-deletion cascade.
- Run `pnpm db:push` and `pnpm check` once for the substantive schema and cross-cutting change.
- After implementation, agree with the user whether to add focused CR019 Playwright E2E validation.
