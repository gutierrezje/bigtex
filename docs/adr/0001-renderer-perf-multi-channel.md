# Renderer perf uses multiple capture channels on Electron

BigTeX **Render profiling runs** combine Chromium CDP tracing, Playwright’s `trace.trace`, and the renderer Long Task API because no single channel is reliable on Electron. We read **Renderer long task** first, Chromium `traceEvents` when present, and **Playwright slow action** last (scenario steps may include scripted waits). Artifacts stay ephemeral under `perf-traces/`; the default **Perf scenario** is `boot-sample` on a normal build, with an optional **Perf build** for React-level marks and `store-stress`.
