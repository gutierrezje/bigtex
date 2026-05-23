# BigTeX

Agentic LaTeX desktop editor: local compile, editor, PDF viewer, and an ACP-backed assistant in one project workspace.

## Language

**Editor pane**:
The main source column (Monaco) with its own tab strip for open project source files (`.tex`, `.bib`, etc.).
_Avoid_: Calling this column a “preview”; it is for editing and reading source.

**PDF viewer pane**:
The column that renders PDFs (project PDFs and compile output) with its own tab strip. Opening a PDF from the tree or after compile focuses a PDF tab here — not a secondary preview of the active editor file.
_Avoid_: Preview (implies a live render tied to the current source tab); PDF previewer (legacy UI label may remain until renamed).

**Editor tab** / **PDF tab**:
One open document in the corresponding pane’s tab strip. The two strips are independent: many source tabs can be open while several PDFs are open beside them. **PDF tabs** close immediately with no save prompt (PDFs are read-only in the viewer).

**Focus or open** (sidebar):
Clicking a project file activates an existing tab for that path in the right pane, or opens a new tab if none exists. Does not duplicate tabs for the same path.

**Focus or open** (compile):
On successful compile, the PDF viewer pane focuses the tab for the output PDF path if one exists, otherwise opens a new PDF tab and loads the fresh bytes. Other PDF tabs stay open.

**Editor tab dirty state**:
A tab shows a dirty indicator while its in-memory draft differs from what is on disk. Switching tabs keeps each tab’s draft in memory with no save prompt. Closing a dirty tab asks for confirmation before discarding. **Autosave** is on by default (same debounced write as today), so dirty usually means “not yet flushed” or “save failed,” not “user must remember to save.”

**Active editor tab**:
The source file tab currently selected in the editor pane. Window title, command bar, and project tree selection follow this path only; the active PDF tab does not change that chrome. When no editor tabs are open, the editor pane shows an empty state; PDF tabs may still be open in the PDF viewer pane. When no PDF tabs are open, the PDF viewer pane shows an empty state; editor tabs may still be open. Collapsing the PDF viewer column via the command bar is separate from closing tabs.

**Compile diagnostic**:
A single issue reported from the latest LaTeX compile (file, optional line, severity, message).
_Avoid_: Log line, problem (unless referring to the UI panel name).

**Problems panel**:
One collapsible Problems / Output strip spanning the **editor pane** and **PDF viewer pane** together (not under the agent column). Shows compile diagnostics from the last run, filterable by All / Errors / Warnings. Header is Problems-first; **Compile** stays in this header.
_Avoid_: Diagnostics panel (internal component name may stay; user-facing label is Problems); duplicating the strip under each document column.

**Agent handoff**:
Pre-filling the assistant composer with a minimal line (`path:line — message`); appends if the composer already has text. The user edits and sends.
_Avoid_: Auto-fix, send-to-agent (implies automatic run), natural-language “fix this error” templates.

**Compile summary**:
A count-only snapshot of the latest compile included automatically in every agent run (error/warning counts, pass/fail, duration, main TeX file).
_Avoid_: Dumping the full diagnostic list into the agent context by default.

**Render profiling run**:
A developer-only scripted session that launches BigTeX, exercises a fixed **perf scenario**, and writes artifacts under `perf-traces/` for humans or agents to analyze. Not shown in the product UI and not a release gate in v1.
_Avoid_: Performance mode, built-in profiler (implies a user-facing feature).

**Renderer perf signal**:
Evidence of UI main-thread responsiveness collected during a **Render profiling run**. Read **Renderer long task** first, **Chromium timeline** when present, **Playwright slow action** last (may include automation waits, not only app jank).
_Avoid_: Treating compile duration, agent run time, or a scripted `waitForTimeout` as proof of UI regression.

**Renderer long task**:
A main-thread block ≥50 ms in the webview, recorded via the Long Task API during a **Render profiling run**.
_Avoid_: Playwright step duration (includes test harness overhead).

**Playwright slow action**:
A single automated UI step in the Playwright trace (e.g. click, wait for selector) that took ≥50 ms during a **Render profiling run**. Describes what the test did; not by itself a verdict on product quality.
_Avoid_: Calling these “long tasks” without qualification (collides with **Renderer long task** and Chromium terminology).

**Perf scenario**:
A named script inside a **Render profiling run** (default: `boot-sample`). `boot-sample` is the **cold UX baseline** (open sample project, editor visible, short settle). `typing-stress` exercises Monaco input. `store-stress` hammers editor state updates without keyboard I/O to expose **global state fan-out** (whether the whole shell re-renders on each store tick), not Monaco or main-process IPC by itself.
_Avoid_: One scenario that tries to test load, typing, compile, and agent in a single pass (use separate scenarios).

**Perf build**:
An optional renderer build flavor that enables extra **Renderer perf signals** (React commit measures, automation bridge for `store-stress`). Not what end users run; used for deeper UI investigations.
_Avoid_: Assuming every **Render profiling run** requires a perf build — the default **cold UX baseline** uses a normal release-like build.

**LLM perf slice**:
The small `llm-*.json` summary from a **Render profiling run**, meant to be pasted into an agent or review thread — not the full trace zip or raw Chromium JSON.
_Avoid_: Trace file (too vague); pasting `summary-*.json` when the filtered slice is enough.

**Interactive renderer profiling**:
Attaching Chrome DevTools to the renderer (e.g. via remote debugging) to record Performance or React Profiler manually. Complements a **Render profiling run** when signals are unclear; does not replace it.
_Avoid_: Requiring DevTools for every change (not repeatable; no standard **LLM perf slice**).

**Go to source**:
**Focus or open** the diagnostic’s file as an **editor tab**, make it the **active editor tab**, and scroll to its line when the user activates a problem row or its navigation control.
_Avoid_: Go to definition (semantic TeX feature — not in scope).

## Relationships

- A **Compile** produces zero or more **Compile diagnostics** shown in the **Problems panel**.
- Before **Compile**, every open **editor tab** with a pending draft is flushed to disk (not only the **active editor tab**).
- Renaming a project path updates any **editor tab** or **PDF tab** for that path in place; deleting a path closes all tabs for that path.
- Open tab lists are **not** restored across app quit or project close in v1 (session-only).
- Opening a project opens one **editor tab** for `project.mainFile` when set; no PDF tab until compile or the user opens a PDF.
- An **Agent handoff** references exactly one **Compile diagnostic** (multi-select attachment is not in scope yet).
- **Agent handoff** expands a collapsed agent panel and focuses the composer; it is available for **errors and warnings**.
- After **Agent handoff**, the next agent run’s file scope is the **union** of the **active editor tab** and the diagnostic’s file (when known).
- Every agent run includes the **Compile summary**; full diagnostic text is not injected unless the user sends it via **Agent handoff** (or types it).
- A **Render profiling run** is independent of **Compile** and **Agent handoff** — it measures **Renderer perf signals**, not LaTeX or agent behavior (unless a **perf scenario** explicitly includes them).
- Main-process timings shown in the Output panel are not **Renderer perf signals**; they are not required to appear in `llm-*.json`.
- **Renderer perf signals** are read in order: **Renderer long task** → Chromium timeline (if captured) → **Playwright slow action** (interpret with scenario context).
- The default **Perf scenario** is `boot-sample` (**cold UX baseline**) on a normal build; compare regressions using the same scenario and build flavor.
- `typing-stress` and `store-stress` are targeted experiments, not interchangeable with the baseline.
- `store-stress` requires a **Perf build** (automation bridge); `boot-sample` and `typing-stress` do not.
- **Render profiling run** artifacts are ephemeral (`perf-traces/` is gitignored); regression is by comparing two local runs with the same **Perf scenario** and build flavor, not by a checked-in golden file in v1.
- **Interactive renderer profiling** complements automated runs; it is optional and used for investigation, not the default regression path.

## Example dialogue

> **Dev:** "Should the sparkle button run the agent?"
> **Domain expert:** "No — that's an **Agent handoff**. It only puts that **Compile diagnostic** in the composer; I still press send."
>
> **Dev:** "Does the agent still get the full error list on every message?"
> **Domain expert:** "Only the **Compile summary** — counts and which main file was built. The full message comes when I hand off a specific line."
>
> **Dev:** "CI failed because Playwright reported a 1.2s wait — is the app broken?"
> **Domain expert:** "That's a **Playwright slow action** from the **cold UX baseline** settle, not a **Renderer long task**. Check long tasks first; don't treat every slow step as a regression."

## Flagged ambiguities

- Screenshot showed a full-width bottom strip; resolved: **Problems panel** spans editor + PDF width only (agent stays full-height beside).
- Screenshot **Info** tab (overfull/underfull hbox); resolved: **Problems panel** lists **errors and warnings only** — no `info` severity in v1.
- Screenshot row chevrons; resolved: **Problems panel** rows are **not expandable** in v1.
- List truncation at 8 items; resolved: show **all** compile diagnostics up to the parser cap (100).
- Unified single tab strip for source + PDF; resolved: **two tab strips** — **Editor pane** tabs and **PDF viewer pane** tabs (Cursor-like reference, not current BigTeX UI).
- Sidebar open behavior; resolved: **focus or open** — no duplicate tabs per path.
- Compile → PDF pane; resolved: **focus or open** on the compile output path (reload if already open).
- Unsaved editor tabs; resolved: dirty dot, confirm on close if still dirty, silent switch; **autosave on by default**.
- Command bar / window title with two panes; resolved: **active editor tab** path only.
- Project tree highlight; resolved: **active editor tab** path only (same as chrome).
- Compile pre-save; resolved: flush **all open editor tabs** with pending drafts.
- Last editor tab closed; resolved: **empty state** in editor pane; PDF pane unaffected.
- Rename/delete with open tabs; resolved: **update tabs in place** on rename; **close tabs** on delete.
- Tab persistence; resolved: **no restore in v1** (session-only).
- Last PDF tab closed; resolved: **empty state** in PDF viewer pane; no auto-collapse.
- Open project; resolved: one **editor tab** for `mainFile` when set; no auto PDF tab.
- "Performance testing" meaning CI gate vs dev workflow; resolved: **Render profiling run** is developer-only (A), ephemeral baselines (A), normal vs **Perf build** tracks (C).
