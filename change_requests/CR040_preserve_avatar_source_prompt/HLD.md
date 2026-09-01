# CR040 — Preserve Avatar Source Prompt for Normal Character Generation

## Status

Implementation completed and validated in application commit `5e5a4ac74a9db90d3e9ad740fbc972b03613c1c1` on `change/CR040-preserve-avatar-source-prompt`.

## Goal

Preserve the original source prompt when generating a normal Character avatar without a reference image, so the request is not replaced by unrelated fallback or derived prompt text.

## Proposed Solution

Keep the existing source prompt intact on the normal Character avatar-generation path by making visual prompt compaction explicit at the compiler handoff. Normal Character avatar preview and final generation disable compaction, while Character Sheet and other image-generation modes retain their existing behavior.

## Risks

An incorrect boundary could affect reference-image or other avatar flows. The change must remain limited to normal Character generation and preserve existing provider/request behavior.

## Validation

Validated with `git diff --check`, `pnpm regression:prompt`, and `pnpm check`. No ComfyUI/provider E2E or manual UI test was performed.
