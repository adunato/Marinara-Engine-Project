# CR031 Implementation Plan — Character Mind Build Validation Recovery

## Status

Proposed. Implementation requires approval.

## Prerequisites

- CR022 corpus-wide Build mapping.
- CR023 in-session map recovery.
- CR025 isolated Build page sessions.
- CR029 resumable Build maps and page checkpoints.
- CR030 streamed page creation and bounded temporary-candidate editing.

## Tasks

### 1. Tighten Build prompts

1. Define `excludedSources` as sources assigned to no page and state that page assignments and exclusions must be disjoint and exhaustive.
2. Add a map preflight instruction covering overlaps and omitted manifest sources.
3. Require each Build page to begin with the exact mapped `# Title` and contain one literal `## Sources` heading.
4. Display the exact allowed raw-source list immediately before the page output instruction and prohibit all other raw citations.

### 2. Aggregate map partition findings

1. Preserve the existing map JSON and structural validation.
2. Collect every assigned/excluded overlap and every unaccounted manifest source after parsing.
3. Return the complete finding set in one correction message.
4. After all mandatory reads succeed, run partition-only correction turns without tools and explicitly prohibit rereading.

### 3. Correct Build-page source enforcement

1. Extract every raw wikilink from the complete candidate, including inline links.
2. Reject paths outside the frozen page assignment before checking verified-read state.
3. Produce corrective feedback that says to remove or replace an outside-assignment citation.
4. Restrict Build-page raw reads to assigned paths without changing other Character Mind operations.

### 4. Repair temporary candidates locally

1. Retain a complete streamed page that is safe to stage but fails local validation as an unpublished temporary candidate.
2. Classify repairable validation findings and provide exact, operation-specific feedback.
3. Run bounded candidate edits for local heading, Sources-section, link, and citation corrections.
4. Revalidate after editing and publish only a fully valid candidate.
5. Fall back to a complete ordinary-text streamed replacement when bounded repair cannot safely express the required change.

### 5. Add retry diagnostics

1. Track validation attempt counts and compact findings for the map and each Build page.
2. Include the attempt summary in success or failure log entries without candidate content.
3. Keep provider-request failures distinct from validation rejections.

### 6. Add focused regressions

1. Cover a map containing several overlaps and an omission, asserting one complete correction response.
2. Assert that a partition-only retry cannot reread the corpus.
3. Cover Setext H1 and formatted Sources-heading corrections against the existing canonical validator.
4. Cover an unassigned inline citation, correct error ordering, and rejected out-of-scope reads.
5. Assert that local defects use bounded candidate edits and do not stream another complete page.
6. Assert that substantive invalidity still permits an explicit complete streamed replacement.
7. Preserve existing transport, publication, failure, cancellation, and resume regressions.

## Expected files

- `packages/server/src/services/character-mind/character-mind.constants.ts`
- `packages/server/src/services/character-mind/character-mind.runtime.ts`
- `packages/server/src/services/character-mind/character-mind.service.ts`
- `packages/server/src/services/character-mind/character-mind.tools.ts`
- `scripts/regressions/character-mind.regression.ts`
- a focused validation result type/helper under `packages/server/src/services/character-mind/` only if needed to avoid error-string branching

No client, route, database, dependency, release, version, or wiki-storage-format change is expected.

## Verification

1. Run the focused Character Mind regression once.
2. Run server TypeScript validation.
3. Run `pnpm check` once because the runtime change is substantive.
4. After approved implementation is merged into the primary application checkout, run the production build there before manual validation.
5. After implementation, agree whether focused Playwright E2E validation would add useful evidence.

## Rollback

Revert the CR031 application commit or commits. This restores CR030's existing prompts, fail-fast validation feedback, complete-page validation retries, and log format. Raw sources, completed wiki pages, Build maps, and checkpoints require no migration.

## Approval gate

Do not begin implementation until the user approves this HLD or directly instructs implementation. Material expansion into other Character Mind operations, UI, durable retry state, or provider transport requires separate approval.
