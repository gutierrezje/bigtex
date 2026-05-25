# BigTeX

**Generated:** 2026-05-19T22:20:47Z
**Commit:** d4ec686

Early MVP agentic LaTeX desktop editor. Electron main + React/Vite renderer with ACP (opencode) agent and local LaTeX compilation.

## STRUCTURE

```
{root}/
├── src/main/            # Electron main: IPC, filesystem, compile, agents, patches
├── src/preload/         # window.bigTex IPC bridge
├── src/renderer/        # Vite shell; UI in src/renderer/src (AGENTS.md)
├── src/shared/          # IPC contracts + domain types
├── samples/workshop/  # resettable demo fixture — never commit changes (see NOTES)
└── electron.vite.config.ts
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| IPC contracts | src/shared/ipc.ts |
| IPC handlers + window lifecycle | src/main/index.ts |
| Application menu (Open/Close Folder) | src/main/menu.ts |
| Preload API surface | src/preload/index.ts |
| Project tree + file IO | src/main/files/project.ts |
| LaTeX compile runner | src/main/compile/latex.ts |
| Agent ACP runtime | src/main/agents/opencode.ts |
| Patch application | src/main/agents/patch.ts |
| Renderer layout + flows | src/renderer/src/App.tsx |
| Editor autosave + diagnostics | src/renderer/src/components/EditorPane.tsx |
| PDF preview | src/renderer/src/components/PdfPreview.tsx |
| Assistant UI runtime | src/renderer/src/components/agent/BigTexAssistantRuntime.tsx |

## CONVENTIONS

- IPC contracts live in src/shared; main/preload/renderer import from there.
- Renderer calls window.bigTex only; filesystem/compile/agent work stays in main.
- Agent backend is ACP-only (`opencode acp`); patches are unified diffs.
- Compiler runs must flush the current draft before invocation.

## ANTI-PATTERNS

- Hardcoding TeX install paths; rely on PATH + user shell setup.
- Spawning `opencode run` or surfacing the opencode command in UI.
- Applying agent patches without the patch IPC (git apply + path checks).
- Throwing compile/agent failures into UI; surface as diagnostics/toasts.
- Committing edits under `samples/workshop/` — reset the fixture instead (`git restore samples/workshop`).

## COMMANDS

```bash
pnpm run format
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
pnpm run perf:trace    # Chromium timeline + llm-*.json in perf-traces/
```

See `scripts/perf/README.md` for scenarios (`BIGTEX_PERF_SCENARIO`, `BIGTEX_PERF_DEV`).

Pre-commit runs Biome lint + format on staged files, then `pnpm test` (`pnpm install` registers hooks).

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `gutierrezje/bigtex`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## KEY CONFIGS

| Tool | Entry | Notes |
|------|-------|-------|
| TypeScript | tsconfig.node.json, tsconfig.web.json | Main/preload vs renderer (root tsconfig is references only) |
| Electron/Vite | electron.vite.config.ts | Build/serve wiring |

## UNIQUE STYLES

- Project tree hides `.tex-build/` (latexmk outdir) plus build/aux dirs and LaTeX artifact extensions.
- ACP messages are parsed for fenced diff blocks; extracted patches emit via IPC.
- Compiler diagnostics merged from latexmk console output and `.tex-build/{main}.log`; capped at 100 entries.
- Performance marks recorded in main via measure()/recordMark; renderer shows latest.

## NOTES

- Do not run `pnpm run dev`.
- `samples/workshop/` ships intentional compile issues for demos and agent testing. **Never commit changes** to it; after runs restore with `git restore samples/workshop` (and drop `samples/workshop/.tex-build/` if present).
- Cleanup: use `latexmk -C` scoped to the sample or active project.
- macOS TeX installs may require PATH helper restart for latexmk.
- `out/` is build output; avoid editing by hand.
