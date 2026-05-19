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
| Monaco editor + autosave + diagnostics markers | components/EditorPane.tsx |
| Diagnostics list + compile button | components/DiagnosticsPanel.tsx |
| PDF rendering + paging | components/PdfPreview.tsx |
| Agent chat UI + patch actions | components/AgentPanel.tsx |
| Assistant runtime adapter | components/agent/BigTexAssistantRuntime.tsx |
| Compiler toggle + metrics bar | components/CommandBar.tsx |

## CONVENTIONS

- App.tsx owns IPC calls and draft flushing; leaf components stay mostly presentational.
- useAgentEvents is the single agent stream listener; keep it mounted at app root.
- EditorPane debounces autosave (~650ms); always call onDraftChange before compile.
- Assistant UI parts must be stable components (no inline lambdas) to avoid remounts.

## ANTI-PATTERNS

- Recreating assistant-ui part components inline (remounts every stream chunk).
- Bypassing the store for agent chat state updates.
