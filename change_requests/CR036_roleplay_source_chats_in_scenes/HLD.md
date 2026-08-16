# CR036: Roleplay Source Chats in Scenes

## Status

Approved for implementation; focused fix completed.

## Problem

Active Scene roleplays can have explicitly selected Source Chats, but the generation route excludes the Source Chats block whenever the target chat is a Scene. This means the provider does not receive source-chat context even though the user selected it.

Scene-specific connected Conversation context, OOC notes, and influences must remain excluded.

## Goal

Include the existing Roleplay Source Chats block in active Scene generation while preserving the existing Scene exclusions for connected Conversation context and related OOC/influence injections.

## Proposed Solution

Remove only the `!isSceneChat` condition from the `buildRoleplayContextSourcesBlock` gate in `generate.routes.ts`. Keep `injectConnectedConversationPromptBlocks` and its Scene behavior unchanged. Add a static-source regression assertion that guards the route condition, document the distinction in the Scene guide, and record the fix in the Unreleased changelog.

## Risks

- Broadening the gate accidentally could re-enable connected Conversation context or other Scene-only exclusions.
- A future refactor could restore the Scene exclusion without the regression assertion.

## Validation

- `pnpm regression:context-sources`
- `pnpm check`

