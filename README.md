# BigTeX

Agent-first Electron LaTeX editor prototype focused on local performance.

## Features

- Electron main process owns file IO, LaTeX compilation, agent subprocesses, and patch application.
- React renderer provides a project tree, Monaco editor, PDF.js preview, diagnostics, and agent panel.
- `opencode` is the default local agent command so users can bring their own opencode Go setup.
- Agent markdown code fences use Shiki highlighting after streaming settles.

## Prerequisites

BigTeX shells out to local CLI tools — nothing is bundled. Install these and ensure they are on your `PATH` (e.g. via MacTeX, TeX Live, or Homebrew):

| Tool | Used for |
|------|----------|
| [`latexmk`](https://ctan.org/pkg/latexmk) | LaTeX compile and **Problems** compile diagnostics |
| [`texlab`](https://github.com/latex-lsp/texlab) | Editor language features (completion, go-to-definition, static diagnostics) |
| [`opencode`](https://opencode.ai/docs/) | Agent panel (ACP) |

After installing OpenCode, log in:

```bash
opencode auth login
```

On macOS, a fresh TeX install sometimes needs a new terminal session (or IDE restart) before `latexmk` and `texlab` are visible on `PATH`.

## Development

```bash
pnpm install
pnpm run dev
```
