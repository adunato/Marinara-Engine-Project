# CR033: Conversation Card Field Injection

## Status

Completed and merged into local application `main` on 2026-08-04.

## Goals

- Keep non-empty Description and Personality fields in Conversation prompts.
- Suppress a fallback field only when the prompt template contains a real macro for that field.
- Preserve the existing handling of Backstory, Appearance, Scenario, Example Dialogue, and advanced system prompts.

## Proposed Solution

Constrain identity-fallback macro detection to the contents of a single `{{...}}` token. The previous expression could cross a closing macro delimiter, consume ordinary prompt prose, and continue into a later macro. As a result, prose such as "personality and description" between `{{charName}}` and `{{commands}}` was mistaken for explicit field macros.

Add a prompt regression fixture that places the ordinary words "personality" and "description" between two unrelated macros and verifies that every populated card field remains in the assembled identity fallback.

## Risks

- A malformed or nonstandard macro containing nested braces will no longer be treated as a field reference. Supported Marinara macros do not use nested braces inside one token.
- An incorrect detector could duplicate a field already deliberately placed by a prompt macro. Existing exact field-content checks remain as a second duplication guard.

## Validation

- `pnpm build` passed in the primary application checkout.
- `git diff --check` passed before commit.
- The focused prompt regression was added but not run at the user's direction.

