import { useState } from "react";
import type { CompileDiagnostic } from "../../../shared/domain";
import type { AgentTranscript } from "../store";
import { AgentMarkdown } from "./AgentMarkdown";

interface AgentPanelProps {
  rootPath: string | null;
  activeFile: string | null;
  diagnostics: CompileDiagnostic[];
  transcript: AgentTranscript | null;
  onRun(prompt: string): Promise<void>;
  onCancel(runId: string): Promise<void>;
  onApplyPatch(patch: string): Promise<void>;
}

export function AgentPanel({
  rootPath,
  activeFile,
  diagnostics,
  transcript,
  onRun,
  onCancel,
  onApplyPatch,
}: AgentPanelProps) {
  const [prompt, setPrompt] = useState(
    "Improve this LaTeX document. Keep edits minimal and return a unified diff.",
  );
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      await onRun(prompt);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-border bg-surface-raised">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Agent
          </span>
          <h2 className="mt-0.5 text-sm font-medium">LaTeX editing assistant</h2>
        </div>
        {transcript?.running ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-danger/40 bg-transparent px-3 py-1 text-xs font-medium text-danger transition-colors duration-100 hover:bg-danger-muted"
            onClick={() => onCancel(transcript.runId)}
          >
            Cancel
          </button>
        ) : null}
      </header>

      {/* Fields */}
      <div className="shrink-0 grid gap-2 px-3 pt-3">
        <label className="grid gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Prompt
          </span>
          <textarea
            className="w-full resize-none rounded-md border border-border bg-surface-inset px-2.5 py-1.5 text-sm text-text-primary outline-none transition-colors duration-100 focus:border-accent/50"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
          />
        </label>
      </div>

      {/* Context */}
      <div className="shrink-0 flex justify-between gap-2 px-3 py-2 text-[11px] text-text-muted">
        <span>{activeFile ? `Selected: ${activeFile}` : "No active file"}</span>
        <span>{diagnostics.length} diagnostic(s)</span>
      </div>

      {/* Run button */}
      <div className="shrink-0 px-3 pb-2">
        <button
          type="button"
          className="w-full rounded-md border-0 bg-accent px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity duration-100 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!rootPath || busy}
          onClick={submit}
        >
          {busy ? "Starting..." : "Run Agent"}
        </button>
      </div>

      {/* Output */}
      <div className="agent-output-markdown mx-3 mb-2 min-h-0 overflow-y-auto overscroll-contain rounded-md bg-surface-inset p-3 text-[13px] leading-relaxed text-text-secondary">
        {transcript ? (
          <AgentMarkdown text={transcript.text} streaming={transcript.running} />
        ) : (
          <p className="text-text-muted">
            Agent runs stream here. Final diff blocks are highlighted with Shiki and can be applied
            explicitly.
          </p>
        )}
      </div>

      {/* Apply patch */}
      {transcript?.patch ? (
        <div className="shrink-0 px-3 pb-3">
          <button
            type="button"
            className="w-full rounded-md border border-accent/30 bg-accent-muted px-4 py-2 text-sm font-semibold text-accent transition-colors duration-100 hover:bg-accent/20"
            onClick={() => onApplyPatch(transcript.patch ?? "")}
          >
            Apply detected patch
          </button>
        </div>
      ) : null}
    </aside>
  );
}
