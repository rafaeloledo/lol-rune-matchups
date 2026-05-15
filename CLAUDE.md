# Instructions for Claude

## Keep the README's "How this project is working" section up to date

The `README.md` contains a section titled **"How this project is working"** that explains the project's architecture, data flow, validation rules, and UI behavior. This section is the canonical onboarding doc for a developer (or future Claude session) walking into the repo cold.

**Rule:** whenever you make a change that affects anything described in that section, update it in the same change. Do not leave the section drifting from the code.

### Triggers that require an update

Update the section whenever you:

- Add, remove, or rename an API endpoint (`/api/*`).
- Change the shape of `/api/enums` or any payload structure documented in the README.
- Change the validation rules in `validate_input` (new required fields, new constraints, different error semantics).
- Change the "single source of truth" model — e.g. moving a constant out of Rust, adding a new enum-like list, changing how `RUNE_TREE_DATA` / `CHAMPIONS` / `SHARD_SLOTS` are structured.
- Change the database schema (new migration, renamed column, new table) in a way that affects the high-level data flow.
- Replace or significantly alter the frontend interaction model — e.g. swapping the combobox for something else, changing the keyboard shortcuts, changing how rune-slot datalists refresh.
- Add, remove, or rename files listed in the "Arquivos relevantes" subsection.
- Add a new build step, runtime dependency, or change how the server is started.

### What "update" means

- Edit the relevant bullets in the "How this project is working" section in the same PR/commit as the code change.
- Keep the writing concise and matched to the existing tone (Portuguese, no emojis, short bullets, code references with relative paths like `[src/main.rs](src/main.rs)`).
- If a subsection becomes obsolete, delete it rather than leave stale prose.
- If the change is large enough that the section's structure no longer fits, restructure it — don't bolt new paragraphs onto a now-wrong scaffolding.

### What does NOT require an update

- Pure refactors that don't change the externally observable behavior or the file layout listed.
- Bug fixes that don't alter validation rules, payload shapes, or UI contracts.
- Cosmetic CSS tweaks that don't change interaction patterns.

### How to verify

After editing, re-read the "How this project is working" section end-to-end and ask: "If I were a new developer reading only this, would the code surprise me?" If yes, keep editing.
