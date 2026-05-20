## Domain docs layout

This repo uses a **single-context** documentation layout:

- `CONTEXT.md` at the repo root (domain language, user workflows, invariants)
- `docs/adr/` at the repo root (architecture decision records)

### Consumer rules (for agents)

- Read `CONTEXT.md` first when making non-trivial product/architecture changes.
- Prefer updating/adding an ADR when making a decision that affects:
  - IPC boundaries (main/preload/renderer)
  - persistence formats (recents, settings)
  - compile/agent execution model
  - security/path-safety rules

### Current state

If `CONTEXT.md` or `docs/adr/` don’t exist yet, create them when you hit the first decision that would benefit from being written down.

