# BigTeX automated render profiling

Captures **Chromium Performance Timeline** traces from the real Electron shell (Playwright Electron + Chromium tracing), then emits a **compact JSON summary** sized for LLM analysis.

## Prerequisites

```bash
pnpm install
```

Requires:

- `out/main/index.js` and `out/renderer/` from `pnpm run build` (renderer build may fail on missing Shiki peers until those deps are installed).
- `unzip` on PATH (macOS/Linux) for Playwright zip fallback.
- A working Electron boot: `pnpm exec electron .` must open BigTeX (perf cannot trace a broken main process).

If `pnpm exec electron .` crashes with `Cannot read properties of undefined (reading 'setName')` or `BrowserWindow` import errors, fix the Electron main entry before running perf scripts.

## Quick start

```bash
pnpm run build          # or: pnpm exec electron-vite build (main+preload only if renderer fails)
pnpm run perf:trace
```

Launch strategy (automatic): **spawn Electron + CDP** → Playwright Electron → preview + CDP → dev + CDP.

```bash
# Force dev server path (longer startup; do not use for normal dev)
pnpm run perf:trace:dev
```

Artifacts land in `perf-traces/` (gitignored):

| File | Contents |
|------|----------|
| `chromium-<scenario>-<timestamp>.json` | Chromium `traceEvents` via `--trace-startup-file-name` |
| `trace-events-*.json` | Copy used by the parser (same as chromium file when present) |
| `trace-<scenario>-<timestamp>.zip` | Playwright trace (screenshots + DOM snapshots) |
| `summary-*.json` | Full parser output |
| `llm-*.json` | Filtered slice for agent context |

Re-parse without relaunching:

```bash
pnpm run perf:parse -- perf-traces/cdp-boot-sample-2026-01-01.json
```

## Scenarios

| `BIGTEX_PERF_SCENARIO` | Behavior |
|------------------------|----------|
| `boot-sample` (default) | Open sample project, settle |
| `typing-stress` | Monaco keyboard loop (40 `%` + backspace) |
| `store-stress` | `window.__BIGTEX_PERF__.stressStoreUpdates(120)` — Zustand-only churn |

```bash
BIGTEX_PERF_SCENARIO=store-stress pnpm run perf:trace
BIGTEX_PERF_HEADLESS=0 pnpm run perf:trace   # visible window
```

## What the parser reports

Implemented in `src/shared/perf/trace-parse.ts`:

- **Long tasks** — complete events (`ph: X`) with duration ≥ 50 ms
- **Paint bursts** — clusters of Layout / Paint / UpdateLayerTree within 32 ms
- **User timings** — `blink.user_timing`, `bigtex:*`, `react:*` marks/measures
- **React-related** — long tasks whose name/category matches react/scheduler/bigtex

Pass `llm-*.json` to your analyst agent; avoid feeding full `cdp-*.json` (often 5–50 MB).

### Interpreting a successful run with empty Chromium events

If you see `No Chromium traceEvents from CDP` but the run exits 0:

- **CDP attached** (`CDP ready on port …`) — automation is working.
- **Chromium timeline** may be empty on Electron when tracing the page CDP session; the harness now also parses **`trace.trace`** inside the Playwright zip and records **Long Task API** entries from the renderer.
- Re-run after pulling latest scripts; `llm-*.json` will include `playwright.slowActions` (e.g. `Frame.waitForSelector`, `Frame.click` ≥50ms) and `rendererLongTasks`.

```bash
BIGTEX_PERF_DEBUG=1 pnpm run perf:trace   # log CDP byte counts
pnpm exec playwright show-trace perf-traces/trace-*.zip   # visual timeline
```

## Renderer instrumentation

When `BIGTEX_PERF_PROFILE=1` at build time:

- `PerfProfiler` wraps `App` → `performance.measure('react:App:mount|update', …)`
- `window.__BIGTEX_PERF__` — automation bridge (`loadSampleProject`, `stressStoreUpdates`)

Production builds omit this (dead-code eliminated via `import.meta.env.VITE_BIGTEX_PERF`).

## React DevTools / profiling build

This harness uses **Chromium timeline + React Profiler User Timing**, not React DevTools Profiler export. For component names in flamegraphs, build with `react-dom/profiling` aliases (optional follow-up).

## LLM workflow

1. Run `pnpm run perf:trace` after a change.
2. Attach `perf-traces/llm-*.json` to the analyst prompt.
3. Ask: long tasks > 50 ms, paint burst windows, `react:*` measures, regression vs baseline.
