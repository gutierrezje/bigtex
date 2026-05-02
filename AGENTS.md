# AGENTS.md

## Task Completion Requirements

- All of `pnpm run format`, `pnpm run lint`, and `pnpm run typecheck` should pass before considering formatting or code-quality-sensitive tasks complete.
- For implementation changes, also run `pnpm run build` unless the change is docs-only or clearly cannot affect runtime/build output.
- Do not run `pnpm run dev`
- Do not run destructive cleanup commands against LaTeX projects. If generated artifacts need cleanup, prefer `latexmk -C` scoped to the sample or active project file.

## Project Snapshot

Tex Ranger is a very early MVP for an agentic LaTeX desktop editor.

The app is Electron-based:

- The Electron main process owns filesystem access, LaTeX compilation, PDF reads, agent subprocesses, and patch application.
- The preload script exposes a narrow typed IPC bridge on `window.texRanger`.
- The React/Vite renderer owns the project tree, Monaco editor, PDF.js preview, diagnostics panel, command bar, and agent UI.

This repository is a very early WIP. Refactors that improve performance, correctness, and long-term maintainability are welcome when they are grounded in the current architecture.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Local-first behavior: keep project files, compiler runs, and agent runs on the user's machine.
4. Keep behavior predictable under load and during failures: compiler errors, missing tools, cancelled agents, partial streams, and app restarts.

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

- Prefer shared modules over duplicating logic across components or IPC handlers.
- Keep process boundaries clear: renderer code should not perform direct filesystem, compiler, patch, or subprocess work.
- Keep IPC contracts in `src/shared` and implementation details in `src/main` or `src/renderer`.
- Do not add broad abstractions until they remove real duplication or match an established project pattern.
- Follow React guidance from "You Might Not Need an Effect": use Effects only for external synchronization, not for derived state or user-event logic.

## Package Roles

- `src/main`: Electron main process. Owns window creation, IPC registration, filesystem services, LaTeX compile runner, opencode runner, patch application, and performance marks.
- `src/preload`: Secure Electron preload bridge. Exposes the typed `window.texRanger` API and nothing else.
- `src/renderer`: React UI. Owns editor/preview/agent UX, client state, autosave behavior, and rendering.
- `src/shared`: Shared TypeScript contracts for domain types and IPC channel/API shapes. Keep this schema/type-focused.
- `samples/minimal`: Small LaTeX project used for smoke testing compiler and PDF preview behavior.

## LaTeX Compilation

- `latexmk` is the default compiler target. `tectonic` is supported as an alternate compiler option.
- Do not hardcode TeX installation paths. MacTeX users may need to restart their shell or run their shell's path-helper equivalent after install.
- Compile should save or flush the current editor draft before invoking the compiler.
- Compiler subprocesses belong in `src/main/compile`, never in the renderer.
- Surface compiler failures as diagnostics instead of throwing UI-breaking errors.

## Agent Runtime

Tex Ranger is currently opencode ACP-first.

- The default command is `opencode acp`.
- Do not use `opencode run` as a fallback.
- Backend startup is internal. Do not expose the opencode command as normal user-facing UI; future backends should be selected through a backend/provider abstraction.
- The app assumes the user installs and authenticates `opencode` separately, including opencode Go if desired.
- Agent subprocess management lives in `src/main/agents/opencode.ts`.
- Agent communication uses ACP JSON-RPC over stdio: `initialize`, `session/new`, `session/prompt`, `session/update`, and client file/permission callbacks.
- Agent output streams to the renderer through IPC events on `agent:event`.
- Agent-proposed file changes should be reviewable unified diffs. Applying patches is explicit and goes through `src/main/agents/patch.ts`.

## Reference Repos and Docs

- opencode docs: https://opencode.ai/docs
- React guidance for Effects: https://react.dev/learn/you-might-not-need-an-effect
