# BigTeX

Agentic LaTeX desktop editor: local compile, editor, PDF viewer, and an OpenCode-backed assistant in one project workspace.

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
A single issue reported from the latest LaTeX compile (file, optional line, severity, message). Authoritative for build failures and anything latexmk reports.
_Avoid_: Log line, problem (unless referring to the UI panel name).

**Language-server diagnostic**:
A single issue reported by the LaTeX language server (Texlab) from static analysis of project sources — e.g. undefined reference/citation before compile. Shown in the editor; may also surface in **Problems** when we unify lists. Does not replace **Compile diagnostic** for “did the last build succeed?”
_Avoid_: Calling these “compile errors” when no compile has run.

**Language-server assist**:
Edit-time features backed by the LaTeX language server: completion, hover, **Go to definition**, and find references (editor command). Applies to the same source kinds as the **editor pane**: `.tex`, `.bib`, `.sty`, and `.cls`. v1 does not include rename, format, code actions, a symbols outline panel, or PDF SyncTeX jumps from the language server.
_Avoid_: LSP (user-facing label); assuming the agent provides these without the editor; bundling Texlab inside the app (v1 expects it on `PATH`).

**Language-server unavailable**:
Texlab is missing or failed to start. The **editor pane** keeps syntax highlighting and **Compile** / **Compile diagnostic** behavior; **Language-server assist** and **Language-server diagnostic** are off. The app shows a small non-blocking notice with install guidance, not a blocking dialog.
_Avoid_: Treating the project as broken; hiding the fact that static assist is disabled.

**Problems panel**:
One collapsible Problems / Output strip spanning the **editor pane** and **PDF viewer pane** together (not under the agent column). Lists **Compile diagnostic** and **Language-server diagnostic** rows in one place, filterable by All / Errors / Warnings. Each row shows a small source badge: **compile** or **static**. Header is Problems-first; **Compile** stays in this header.
_Avoid_: Diagnostics panel (internal component name may stay; user-facing label is Problems); a second problems list elsewhere in the shell.

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
**Focus or open** the diagnostic’s file as an **editor tab**, make it the **active editor tab**, and scroll to its line when the user activates a **Compile diagnostic** or **Language-server diagnostic** row in **Problems**, or its navigation control.
_Avoid_: Conflating this with **Go to definition** (symbol navigation while editing).

**Go to definition**:
Editor command (e.g. Cmd-click) that jumps to the target of a LaTeX symbol — `\input`, `\ref`, `\cite`, macro, etc. — via the language server. Does not run compile and does not invoke the agent.
_Avoid_: Go to source (Problems-driven navigation only).

**User settings**:
Preferences that apply across all projects and app sessions until the user changes them.
_Avoid_: Global config (too generic); app config (collides with build/config files).

**Workspace settings**:
Preferences scoped to one open project, keyed by that project’s root folder on disk.
_Avoid_: Project file (implies a file inside the repo); `.vscode/settings.json` (we are not VS Code-compatible in v1).

**Agent provider group**:
The assistant model family shown in the agent toolbar: Free, Go, or Copilot — not the raw OpenCode provider id string.
_Avoid_: Provider (ambiguous with LLM vendor or Copilot product name alone).

**Agent permission**:
A mid-run request from the assistant runtime to read or write project files (surfaced via OpenCode serve `permission.updated`).
_Avoid_: Patch (file edits delivered as a unified diff are separate); Composer send (user still chooses when to run the agent).

**Agent permission mode**:
A **User setting** controlling whether **Agent permission** requests are auto-approved or shown to the user first.
_Avoid_: Auto-run (sounds like sending messages without the user); YOLO mode (informal).

**Detected patch**:
A unified diff extracted from the assistant transcript (fenced `diff` / `patch` blocks) and shown on the assistant message.
_Avoid_: Agent patch (too vague); git patch (implies VCS, not our apply path).

**Patch apply**:
Applying a **Detected patch** to the open project via the app’s patch IPC (`git apply` with path checks) — not direct editor buffer edits.
_Avoid_: Accept changes (Cursor wording); save (autosave is unrelated).

**Patch apply mode**:
A **User setting** controlling whether **Detected patch**es are applied automatically after a run or only when the user clicks **Apply detected patch**.
_Avoid_: Auto-save (editor flush); agent permission mode (orthogonal in v1).

**Settings**:
The in-app preferences UI for **User settings** and **Workspace settings** (opened from app chrome, menu, or `Cmd+,`).
_Avoid_: Preferences dialog (generic); project settings file (no repo-local settings file in v1).

**Settings scope**:
Whether the **Settings** detail pane is editing **User settings** or **Workspace settings** for the open project.
_Avoid_: Profile, configuration tab (ambiguous).

**Agent permission prompt**:
The in-run UI that asks the user to allow or deny an **Agent permission** when **Agent permission mode** is Ask.
_Avoid_: Patch approval ( **Patch apply** is separate); system dialog (native OS dialog is not used in v1).

**Agent model preference**:
The chosen **Agent provider group**, base model id, and optional reasoning level for the assistant.
_Avoid_: Model config (collides with live agent session catalog); provider (use **Agent provider group**).

**Effective agent model preference**:
The **Agent model preference** in force for the open project: workspace value when set, otherwise **User settings** default, otherwise app fallback.
_Avoid_: Current model (collides with live OpenCode session state).

**Settings file**:
The single on-disk store for **User settings** and per-root **Workspace settings** (app user data, not inside the LaTeX project).
_Avoid_: `.bigtex` project config (not in repo in v1); renderer **Settings** UI (the overlay).

## Relationships

- A **Compile** produces zero or more **Compile diagnostics** in **Problems**. **Language-server diagnostics** appear there too (and as editor squiggles). **Compile diagnostic** wins for build pass/fail and **Compile summary**; duplicate file/line issues from both sources may appear until the user fixes them.
- Opening a project starts (or reuses) a per-workspace LaTeX language-server session in the main process, rooted at that project’s folder on disk.
- Closing the project stops that session. The renderer never spawns Texlab directly.
- **Language-server assist** applies to open **editor tab** buffers; **Go to definition** is independent of **Agent handoff**.
- Every open **editor tab** pushes live buffer text to the language server (debounced), not only what is on disk after autosave.
- When **Language-server unavailable**, none of the language-server relationships apply until Texlab becomes available.
- The language server’s project root document is the same path as **Compile**’s main TeX file (`project.mainFile`); both use the same inference when unset.
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
- **User settings** and **Workspace settings** are separate stores; workspace values override user defaults for agent model choices on that project only.
- **Workspace settings** for agent model apply when a project is opened; changing them updates the in-session agent toolbar selection.
- **User settings** include **Agent permission mode**, **Patch apply mode**, and UI preferences (e.g. PDF viewer invert); they are not duplicated per workspace in v1.
- **Agent permission mode** applies to **Agent permission** requests during a run; it does not gate **Patch apply**.
- **Patch apply mode** applies only to **Detected patch**es; it does not replace **Agent permission** for non-diff file access.
- A **Detected patch** is always visible on the assistant message; **Patch apply** success or failure is reported in **Output** / a toast, not only in chat.
- **Settings** edits **User settings** or **Workspace settings** by **Settings scope**; changes apply immediately (no separate Save action in v1).
- **Settings** is a full-window overlay; it does not replace the **editor pane** or add a permanent settings column.
- **User settings** and **Workspace settings** slices are persisted together in the **Settings file**; main process owns load, merge, and write.
- With no project open, **Settings** only exposes **User settings** (**Settings scope** workspace tab disabled).
- **Workspace settings** may store an **Agent model preference** per project root; **User settings** store the default **Agent model preference** when that workspace has none.
- **Effective agent model preference** is the single runtime answer for “which model is this project using?” — not separate toolbar vs **Settings** vs disk copies.
- The agent toolbar and **Settings** (workspace scope) are two views over **Effective agent model preference**; edits go through one update path that persists the workspace slice (and updates the live session).
- When **Agent permission mode** is Ask, a pending **Agent permission** shows an **Agent permission prompt** in the agent column; denying cancels that permission request for the run.
- A pending **Agent permission** expands a collapsed agent panel (same as **Agent handoff**) so the **Agent permission prompt** is visible.
- Open tab lists and panel layout are not **User settings** or **Workspace settings** in v1 (session-only).

## Example dialogue

> **Dev:** "Should the sparkle button run the agent?"
> **Domain expert:** "No — that's an **Agent handoff**. It only puts that **Compile diagnostic** in the composer; I still press send."
>
> **Dev:** "Does the agent still get the full error list on every message?"
> **Domain expert:** "Only the **Compile summary** — counts and which main file was built. The full message comes when I hand off a specific line."
>
> **Dev:** "CI failed because Playwright reported a 1.2s wait — is the app broken?"
> **Domain expert:** "That's a **Playwright slow action** from the **cold UX baseline** settle, not a **Renderer long task**. Check long tasks first; don't treat every slow step as a regression."
>
> **Dev:** "Where do I save the model I want for this thesis repo?"
> **Domain expert:** "**Workspace settings** — provider group and model for this root path. **User settings** only supply the default when that workspace has never been configured."
>
> **Dev:** "Toolbar says glm-5 but Settings still shows the old model — which wins?"
> **Domain expert:** "Neither — there’s only **Effective agent model preference**. Both UIs call the same update; if they disagree, that’s a bug."

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
- Settings scope (user vs project); resolved: two tiers — **User settings** (global) and **Workspace settings** (per `project.rootPath`); agent permission mode is user-global in v1.
- “Auto vs prompt” for the agent; resolved: **Agent permission mode** (OpenCode permissions during a run), plus separate **Patch apply mode** for **Detected patch**es — not confirm-before-every-composer-send.
- Agent autonomy UI; resolved: two independent **User settings** toggles under **Agent** — permission (Ask default) and patches (Review before apply default); no single combined autonomy switch in v1.
- Settings shell; resolved: **Settings** overlay (VS Code–like categories + detail, **User** \| **Workspace** **Settings scope** tabs); gear + menu + `Cmd+,`; Agent and PDF viewer categories in v1.
- Agent toolbar vs workspace prefs; resolved: mirror + persist — toolbar and **Settings** (workspace scope) stay in sync; **User settings** defaults only when workspace has no entry.
- Permission prompt placement; resolved: **Agent permission prompt** as a sticky banner above the agent composer; Allow once / Allow for session / Deny; queue indicator when multiple are pending.
- Agent model persistence shape; resolved: store full **Agent model preference** triple (group + model + reasoning); revalidate against the live catalog on load.
- Single source of truth; resolved: one **Effective agent model preference** at runtime (merged in main, mirrored in renderer store); two persistence tiers remain for defaults vs per-project overrides, not two competing UI states.
- Settings persistence; resolved: one app **Settings file** in Electron user data (`settings.json`) with `user` and `workspaces` sections — not separate user/workspace files on disk.
- PDF invert storage; resolved: one-time import from renderer `localStorage` into **User settings** when missing, then **Settings file** only.
- Settings MVP categories; resolved: **Agent**, **PDF viewer**, **General** (clear recent projects only); defer editor font, autosave toggle, panel layout restore, in-repo project config.
