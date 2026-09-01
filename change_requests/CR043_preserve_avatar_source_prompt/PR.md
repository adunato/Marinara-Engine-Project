## Why this change

Normal Character avatar generation could discard useful avatar details when the source prompt was compacted into unrelated fallback or derived visual text. Preserving the original source prompt keeps the character's intended appearance intact during avatar generation.

## What changed

- Disabled visual prompt compaction for normal Character avatar preview and final generation while preserving existing Character Sheet and other image-generation behavior.
- Added focused regression coverage for source-prompt preservation and both Character route compiler handoffs.

## Validation

- [x] `cd Marinara-Engine && pnpm check`
- [ ] Manual verification completed (describe below)

Automated validation also included:

- `pnpm regression:prompt` passed.
- `git diff --check` passed.
- Application commit `5e5a4ac74a9db90d3e9ad740fbc972b03613c1c1` is on `change/CR043-preserve-avatar-source-prompt`.
- No ComfyUI/provider E2E test was performed.

### Manual verification notes

- No manual verification performed.

## Docs and release impact

- [x] No docs changes needed
- [ ] Updated docs (README / CONTRIBUTING / android/README / CHANGELOG) as needed
- [ ] Version/release files updated (only if this PR includes a version bump)

## UI evidence (if applicable)

Not applicable.
