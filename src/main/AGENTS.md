# Electron Main Process

**Generated:** 2026-05-19T22:20:47Z
**Commit:** d4ec686

Electron main runtime: window creation, IPC, compile/agent/patch/file services.

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Window creation + IPC handlers | index.ts |
| Application menu (File → Open Folder) | menu.ts |
| Agent ACP runtime + JSON-RPC handling | agents/opencode.ts |
| Patch application (git apply) | agents/patch.ts |
| LaTeX compiler runner | compile/latex.ts |
| Texlab LSP session + IPC proxy | lsp/texlab.ts |
| Project tree + file IO + path safety | files/project.ts |
| Performance marks + metrics | performance/marks.ts |

## CONVENTIONS

- Validate paths with assertInsideRoot before any file/patch/agent FS access.
- Wrap IPC handlers with measure() when you want metrics surfaced in UI.
- Spawn child processes with shell:false and capture stdout/stderr for diagnostics.
- ACP client methods are explicitly whitelisted (fs/read_text_file, fs/write_text_file).

## ANTI-PATTERNS

- Skipping path validation for agent-selected files or patch targets.
- Letting ACP JSON parse errors crash the run; emit stderr events instead.
- Treating compiler failure as exception; return CompileResult diagnostics.
