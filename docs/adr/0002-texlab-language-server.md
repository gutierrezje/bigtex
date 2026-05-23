# Texlab in main with Monaco language client in renderer

BigTeX adds **Language-server assist** and **Language-server diagnostic** via [Texlab](https://github.com/latex-lsp/texlab), with **Compile diagnostic** remaining authoritative for build pass/fail.

## Decision

- **Main process** spawns `texlab` (stdio JSON-RPC), one session per open project, stopped on project close. Same lifecycle pattern as `latexmk` and `opencode acp`.
- **Renderer** uses `monaco-languageclient` with an IPC-backed transport; v1 registers completion, hover, definition, references, and diagnostics only (no rename/format/code actions).
- **Open editor tabs** sync live buffer text via LSP `didOpen` / `didChange` (debounced), not disk-only after autosave.
- **Root document** for Texlab matches **Compile** `mainFile` inference.
- **Problems panel** merges compile and static rows with per-row **compile** / **static** badges; editor markers use separate owners (`latex-compiler`, `latex-lsp`).
- If Texlab is missing or fails to start (**Language-server unavailable**), show a soft notice; edit + **Compile** continue unchanged.

## Alternatives considered

| Alternative | Why not v1 |
|-------------|------------|
| Renderer-spawned Texlab | Breaks IPC/security convention; harder to test |
| Disk-only LSP sync | Stale completion/navigation while typing with autosave |
| Problems compile-only | Static issues (undefined `\ref` before compile) invisible to handoff |
| Hand-rolled LSP IPC | Reinvents `monaco-languageclient` for every feature |
| Bundled Texlab binary | Better install story later; PATH check is enough for MVP |

## Consequences

- New IPC surface in `src/shared` + main handler module (e.g. `src/main/lsp/texlab.ts`).
- `EditorPane` gains a language-client lifecycle tied to project + open tabs.
- README documents `texlab` on `PATH` alongside `latexmk` and OpenCode.
- Perf: debounced `didChange` traffic; watch **typing-stress** scenario after integration.
