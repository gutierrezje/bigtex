import type { CompileResult } from "../../../shared/domain";

interface DiagnosticsPanelProps {
  result: CompileResult | null;
  onCompile(): void;
  compiling: boolean;
}

export function DiagnosticsPanel({ result, onCompile, compiling }: DiagnosticsPanelProps) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-raised">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Compiler
          </span>
          <strong className="mt-0.5 block text-sm font-medium">
            {result
              ? `${result.success ? "Clean" : "Needs attention"} · ${result.durationMs}ms`
              : "Not run"}
          </strong>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border bg-transparent px-3 py-1 text-xs font-medium text-text-muted transition-colors duration-100 hover:border-accent/40 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onCompile}
          disabled={compiling}
        >
          {compiling ? "Compiling..." : "Compile"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {result?.diagnostics.length ? (
          <ul className="grid gap-1.5">
            {result.diagnostics.slice(0, 8).map((d, i) => (
              <li
                key={`${d.message}-${i}`}
                className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 rounded-md bg-zinc-900/60 px-2.5 py-2"
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-widest ${
                    d.severity === "error" ? "text-danger" : "text-accent"
                  }`}
                >
                  {d.severity}
                </span>
                <p className="m-0 text-xs leading-relaxed text-text-secondary">
                  {[d.file, d.line].filter(Boolean).join(":") || "project"}: {d.message}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-xs text-text-muted">
            {result?.success
              ? "No diagnostics. The current PDF is ready."
              : "Compile output and diagnostics will appear here."}
          </p>
        )}
      </div>
    </section>
  );
}
