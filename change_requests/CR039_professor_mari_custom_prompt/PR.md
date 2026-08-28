## Why this change

Professor Mari users have no single, persistent way to provide standing guidance that is applied consistently across every Home workspace turn. Skills and Memories do not provide a direct role choice for one always-present instruction, which makes predictable steering harder. This change adds a separate global custom prompt while leaving the built-in Professor Mari behavior and server-side controls intact.

## What changed

- Added a globally persisted Professor Mari custom-prompt setting with enabled state, role selection, validation, safe defaults, and app-settings API handling.
- Injected the configured prompt as one distinct logical message immediately after the built-in Professor Mari system prompt on each new turn, while preserving command-round reuse and existing provider normalization.
- Added the Custom Prompt control and editor beside Memories, including role selection, save behavior, localization, and persistence feedback.
- Added focused Professor Mari custom-prompt regression coverage and updated the user documentation in `docs/home/professor-mari.md`.

## Validation

- [x] `cd Marinara-Engine && pnpm check`
- [ ] Manual verification completed (describe below)

Automated validation also included:

- `pnpm install --frozen-lockfile` passed; no lockfile or manifest changes were made.
- `pnpm regression:professor-mari-custom-prompt` passed.
- `git diff --check` passed.
- `pnpm check` passed with only circular-dependency and oversized-chunk warnings.

### Manual verification notes

- No manual verification performed.

## Docs and release impact

- [ ] No docs changes needed
- [x] Updated docs (README / CONTRIBUTING / android/README / CHANGELOG) as needed
- [ ] Version/release files updated (only if this PR includes a version bump)

## UI evidence (if applicable)

Not applicable.
