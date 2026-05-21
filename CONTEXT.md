# BigTeX

Agentic LaTeX desktop editor: local compile, editor, PDF preview, and an ACP-backed assistant in one project workspace.

## Language

**Compile diagnostic**:
A single issue reported from the latest LaTeX compile (file, optional line, severity, message).
_Avoid_: Log line, problem (unless referring to the UI panel name).

**Problems panel**:
The collapsible list under the editor showing compile diagnostics from the last run, filterable by All / Errors / Warnings. Header is Problems-first; **Compile** stays in this header.
_Avoid_: Diagnostics panel (internal component name may stay; user-facing label is Problems).

**Agent handoff**:
Pre-filling the assistant composer with a minimal line (`path:line — message`); appends if the composer already has text. The user edits and sends.
_Avoid_: Auto-fix, send-to-agent (implies automatic run), natural-language “fix this error” templates.

**Compile summary**:
A count-only snapshot of the latest compile included automatically in every agent run (error/warning counts, pass/fail, duration, main TeX file).
_Avoid_: Dumping the full diagnostic list into the agent context by default.

**Go to source**:
Opening the diagnostic’s file in the editor and scrolling to its line when the user activates a problem row or its navigation control.
_Avoid_: Go to definition (semantic TeX feature — not in scope).

## Relationships

- A **Compile** produces zero or more **Compile diagnostics** shown in the **Problems panel**.
- An **Agent handoff** references exactly one **Compile diagnostic** (multi-select attachment is not in scope yet).
- **Agent handoff** expands a collapsed agent panel and focuses the composer; it is available for **errors and warnings**.
- After **Agent handoff**, the next agent run’s file scope is the **union** of the open file and the diagnostic’s file (when known).
- Every agent run includes the **Compile summary**; full diagnostic text is not injected unless the user sends it via **Agent handoff** (or types it).

## Example dialogue

> **Dev:** "Should the sparkle button run the agent?"
> **Domain expert:** "No — that's an **Agent handoff**. It only puts that **Compile diagnostic** in the composer; I still press send."
>
> **Dev:** "Does the agent still get the full error list on every message?"
> **Domain expert:** "Only the **Compile summary** — counts and which main file was built. The full message comes when I hand off a specific line."

## Flagged ambiguities

- Screenshot showed a full-width bottom strip; resolved: **Problems panel** stays under the editor column only.
- Screenshot **Info** tab (overfull/underfull hbox); resolved: **Problems panel** lists **errors and warnings only** — no `info` severity in v1.
- Screenshot row chevrons; resolved: **Problems panel** rows are **not expandable** in v1.
- List truncation at 8 items; resolved: show **all** compile diagnostics up to the parser cap (100).
