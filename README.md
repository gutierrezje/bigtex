# BigTeX

Agent-first Electron LaTeX editor prototype focused on local performance.

## Features

- Electron main process owns file IO, LaTeX compilation, agent subprocesses, and patch application.
- React renderer provides a project tree, Monaco editor, PDF.js preview, diagnostics, and agent panel.
- `opencode` is the default local agent command so users can bring their own opencode Go setup.
- Agent markdown code fences use Shiki highlighting after streaming settles.

## OpenCode

The agent needs [OpenCode](https://opencode.ai/docs/) on your `PATH`. Install it, then log in:

```bash
opencode auth login
```

## Development

```bash
pnpm install
pnpm run dev
```

Compile requires `latexmk` on your `PATH`. The agent requires OpenCode as described above.
