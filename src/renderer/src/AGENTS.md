# Renderer UI (React)

**Generated:** 2026-05-19T22:20:47Z
**Commit:** d4ec686

React/Vite renderer for editor, preview, diagnostics, agent UI.

## STRUCTURE

```
src/renderer/src/
├── components/          # panels + layout
├── components/agent/    # assistant-ui runtime adapter
├── hooks/               # IPC event subscriptions
├── lib/                 # syntax highlight helpers
├── styles/              # app-level CSS
└── fonts/               # Geist fonts
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| App layout + IPC orchestration | App.tsx |
| Global UI + agent state (Zustand) | store.ts |
| Agent event subscription | hooks/useAgentEvents.ts |
| Welcome open + recents IPC | hooks/useWelcomeOpen.ts |
| Monaco editor + autosave + diagnostics markers | components/EditorPane.tsx |
| Diagnostics list + compile button | components/DiagnosticsPanel.tsx |
| PDF rendering + paging | components/PdfPreview.tsx |
| Agent chat UI + patch actions | components/AgentPanel.tsx |
| Assistant runtime adapter | components/agent/BigTexAssistantRuntime.tsx |
| App-wide top chrome (window controls, toggles) | components/AppChromeBar.tsx |

## App.tsx (integration shell)

`App.tsx` is intentionally large (~700+ lines): resizable shell layout plus IPC orchestration into Zustand and child panels. It is not the place for domain rules — those live in `shared/`, `store.ts`, and main.

When extending the app:

- New `window.bigTex` flows → add a hook or small module; keep `App` as wiring. See `hooks/useWelcomeOpen.ts` for the welcome/recents pattern; `useProjectActions` / `ProjectShellLayout` are future splits if needed.
- Do not add parsing, patch application, compile diagnostics, or agent protocol logic here.
- Split when a feature needs its own tests or when cross-feature coupling in `App` starts to grow (not merely because line count is high).

## CONVENTIONS

- App.tsx owns IPC calls and draft flushing; leaf components stay mostly presentational.
- Projects open via welcome actions or File → Open Folder; both welcome IPC and menu `project:opened` funnel through `loadProject` in App.tsx (`onOpened/onClosed` for menu-driven open/close).
- WelcomeScreen is presentational; recents and welcome open IPC live in `hooks/useWelcomeOpen.ts`.
- useAgentEvents is the single agent stream listener; keep it mounted at app root.
- EditorPane debounces autosave (~650ms); always call onDraftChange before compile.
- Assistant UI parts must be stable components (no inline lambdas) to avoid remounts.

## ANTI-PATTERNS

- Recreating assistant-ui part components inline (remounts every stream chunk).
- Bypassing the store for agent chat state updates.
- Growing `App.tsx` with new domains or cross-feature orchestration instead of hooks/shared/main.
