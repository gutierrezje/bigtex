# Tex Ranger

Agent-first Electron LaTeX editor prototype focused on local performance.

## Features

- Electron main process owns file IO, LaTeX compilation, agent subprocesses, and patch application.
- React renderer provides a project tree, Monaco editor, PDF.js preview, diagnostics, and agent panel.
- `opencode` is the default local agent command so users can bring their own opencode Go setup.
- Agent markdown code fences use Shiki highlighting after streaming settles.

## Development

```bash
npm install
npm run dev
```

Compile requires either `latexmk` or `tectonic` on your `PATH`. Agent runs require `opencode`
to be installed and authenticated separately.
