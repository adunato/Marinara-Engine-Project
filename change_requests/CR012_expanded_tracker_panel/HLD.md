# CR012 Expanded Tracker Panel HLD

Status: Implemented — merged into application main
Date: 2026-07-26

Approved by the user and implemented on 2026-07-26. Application commit `6a4d94cf` changes the expanded desktop target from 420px to 840px; merge commit `df1d4a11` includes it in custom application `main`.

## Problem Statement

The Tracker panel offers compact, standard, and expanded desktop size profiles, but their current widths are 280px, 340px, and 420px. The expanded profile is therefore only 1.5 times the compact width and does not provide a materially expanded workspace for longer tracker values, multiple columns, or larger tracker collections.

## Goals

- Make the existing expanded Tracker profile visibly and practically larger.
- Target an 840px desktop width, equal to three times the 280px compact width.
- Keep compact and standard widths unchanged.
- Preserve the existing size-profile control and persisted user selection.
- Keep the panel usable on narrower screens through responsive width clamping.

## Non-Goals

- Do not redesign tracker fields, locking, hiding, adding, deletion, or agent behavior.
- Do not change tracker persistence, prompts, snapshots, or server APIs.
- Do not add free-form panel resizing.
- Do not change the mobile Tracker presentation beyond preserving its existing viewport-safe behavior.

## Proposed Solution

- Change the expanded desktop profile target from 420px to 840px.
- Keep the current compact target at 280px and standard target at 340px.
- Retain the existing responsive layout and content reflow so expanded sections can use additional columns and longer readable values.
- Clamp the expanded panel to the safely available desktop viewport when 840px cannot fit.
- Verify that selecting expanded produces a materially wider surface in both Conversation and Roleplay without changing the selected profile or tracker data.

## Risks

- An 840px panel can compete with the chat surface on modest desktop widths.
- Existing gutter-based width resolution may constrain the panel enough that expanded still feels too small on some layouts.
- Components with container-query breakpoints may expose latent layout defects at the larger width.

## Validation

- Verify compact remains 280px and standard remains 340px.
- Verify expanded targets 840px on a sufficiently wide desktop viewport.
- Verify the panel remains within the usable viewport at narrower desktop widths.
- Verify Conversation and Roleplay use the same expanded sizing behavior.
- Verify switching among all three profiles still persists correctly.
- Run `pnpm check` from the application repository.
- After implementation, agree whether focused Playwright E2E validation is needed for CR012.
