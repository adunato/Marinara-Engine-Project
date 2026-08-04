# CR022 — Corpus-Aware Character Mind Build

## Problem

CR019 currently uses the Karpathy LLM Wiki `ingest` operation as the initial build algorithm. Marinara snapshots the Character Card and formed Daily Memories, then asks the LLM to ingest each source sequentially. The first source therefore determines the initial page structure before the agent has seen the corpus. In practice a Character Card tends to create one catch-all character page and later memories are funnelled into it.

That is appropriate only after a useful wiki map already exists. It is not a sound way to bootstrap one autonomously.

## Outcome

Character Mind keeps the Karpathy raw-source/wiki/schema model, but separates initial compilation from incremental ingest:

1. **Build map:** survey the complete current source corpus and return a page map.
2. **Materialize map:** read the mapped evidence and write every mapped wiki page plus the final index.
3. **Sync:** only after a successful Build, ingest changed sources incrementally into the established wiki.

The page map is based on the schema and on the corpus as a whole. It is not derived from source order, does not create one page per source, and does not impose a fixed psychological taxonomy.

## Sources

Sources remain deterministic Markdown snapshots of data Marinara already owns. No LLM summarizes or reinvents them before wiki compilation.

- `raw/character-card/`: the current Character Card and Conversation `aboutMe` override.
- `raw/auto-summaries/day/`: each existing Conversation day summary and its key details.
- `raw/auto-summaries/week/`: each existing Conversation week summary and its key details.
- `raw/daily-memories/`: each formed day of user-reviewable Daily Memories.

Each logical source is revisioned independently. Build and Sync operate on the current revision of each logical source; superseded raw snapshots remain provenance but are not treated as current corpus inputs.

## Build lifecycle

### Pass 1: corpus map

The planner receives the complete current raw-source manifest. It must read `SCHEMA.md`, `index.md`, and every current raw source before returning:

```json
{
  "summary": "Mapped the current corpus",
  "pages": [
    {
      "path": "wiki/example.md",
      "title": "Example",
      "purpose": "What this page synthesizes and why it is a reusable subject",
      "sources": ["raw/character-card/...md", "raw/daily-memories/...md"]
    }
  ],
  "excludedSources": [
    { "path": "raw/auto-summaries/day/...md", "reason": "Duplicates more precise current evidence" }
  ]
}
```

Every current source must either support at least one planned page or be explicitly excluded with a reason. Paths must be unique flat `wiki/*.md` paths. The plan must contain at least one page, but Marinara does not mandate page categories or a target page count.

Marinara renders this plan into `index.md` before Pass 2. The index is therefore the page map, not an index inferred after arbitrary pages already exist.

### Pass 2: materialization

The builder receives the frozen page plan, reads the evidence assigned to its pages, writes every planned page, and finalizes `index.md`. Each page:

- is a synthesis of its subject rather than a source recap;
- may combine any source types;
- contains ordinary prose, wikilinks, and a `## Sources` section;
- preserves specific details, uncertainty, contradiction, and provenance;
- stays as long as its subject requires, within the existing safety ceiling; page splitting is semantic rather than token-budget-driven.

Build succeeds only when every planned page exists, all cited raw sources were read, the index catalogs the complete wiki, and deterministic link validation passes.

### Failure and retry

An initialized directory is not considered built until a successful `build` log entry exists. A failed Build retains its raw snapshots and log for diagnosis. The UI continues to offer **Build**, not Sync or Query. Retrying Build clears only generated wiki pages and the provisional index, then recreates the map from the current corpus.

## Sync lifecycle

Sync remains the Karpathy incremental ingest operation, but is gated on a successful Build. Marinara snapshots current inputs, selects only unprocessed current revisions, and processes them one at a time against the established index and wiki. It does not replay superseded raw revisions.

This is the correct place for source-driven maintenance: the map already supplies the organizing structure, while the schema still permits a genuinely new subject to create a page when new evidence warrants it.

## Query and lint

Query and lint remain separate operations and require a completed Build. Query uses the wiki to navigate concepts and follows citations into raw Character Cards, auto-summaries, and Daily Memories for concrete detail. Lint may reorganize the established wiki but is not the initial ontology builder.

## Runtime contracts

The Character Mind runtime adds `plan` and `build` operations alongside `ingest`, `query`, and `lint`.

- Plan is read-only and must read the complete current source manifest.
- Build is writable and must create every planned page and update the index.
- Runtime output budgets use the configured Character Mind agent maximum rather than a hidden 1,500-token ingest/build cap.
- Operation traces and `log.md` distinguish `build-map`, `build`, and later `ingest` work.

## UI

No mind browser or editor is added. The existing operational modal changes only where needed to:

- describe Build as a two-pass corpus operation;
- distinguish an initialized-but-incomplete Build from a usable mind;
- allow Build retry after a failed initial compilation.

Manual Markdown access remains through the existing folder action and external tools such as Obsidian.

## Non-goals

- Message-response generation integration.
- A fixed beliefs/emotions/goals/relationships schema.
- A visual mind browser, graph, or Markdown editor.
- Re-summarizing Character Cards, auto-summaries, or Daily Memories with an LLM before Build.
- Enterprise workflow machinery, distributed jobs, or a separate database for build plans.

## Acceptance criteria

1. Build snapshots Character Card, day/week auto-summaries, and formed Daily Memories without LLM transformation.
2. Pass 1 reads every current source and creates one corpus-level page map before any wiki page is written.
3. Pass 2 writes exactly the mapped page set and a complete index.
4. Source order cannot cause the Character Card to become the initial catch-all page.
5. Sync is rejected until Build succeeds and then processes only current unprocessed revisions.
6. Failed Build can be retried from the existing UI without deleting raw provenance or the log.
7. Query can follow wiki citations into every supported raw source type.
8. Focused regressions cover snapshot determinism, plan validation, two-pass Build gating, and current-revision selection.
