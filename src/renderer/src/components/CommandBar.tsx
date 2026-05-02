import type { CompilerKind, PerformanceMark } from "../../../shared/domain";

interface CommandBarProps {
  compiler: CompilerKind;
  metrics: PerformanceMark[];
  onCompilerChange(compiler: CompilerKind): void;
  onRefreshMetrics(): void;
}

export function CommandBar({
  compiler,
  metrics,
  onCompilerChange,
  onRefreshMetrics,
}: CommandBarProps) {
  const latestMetric = metrics.at(-1);

  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      {/* Compiler toggle */}
      <div className="flex gap-0.5 rounded-md bg-zinc-900 p-0.5">
        <button
          type="button"
          className={`rounded-[5px] border-0 px-3 py-1 text-xs font-medium transition-colors duration-100 ${
            compiler === "latexmk"
              ? "bg-accent text-zinc-950"
              : "bg-transparent text-text-muted hover:text-text-secondary"
          }`}
          onClick={() => onCompilerChange("latexmk")}
        >
          latexmk
        </button>
        <button
          type="button"
          className={`rounded-[5px] border-0 px-3 py-1 text-xs font-medium transition-colors duration-100 ${
            compiler === "tectonic"
              ? "bg-accent text-zinc-950"
              : "bg-transparent text-text-muted hover:text-text-secondary"
          }`}
          onClick={() => onCompilerChange("tectonic")}
        >
          tectonic
        </button>
      </div>

      <button
        type="button"
        className="rounded-md border border-border bg-transparent px-3 py-1 text-xs font-medium text-text-muted transition-colors duration-100 hover:border-accent/40 hover:text-text-secondary"
        onClick={onRefreshMetrics}
      >
        Refresh metrics
      </button>

      <span className="ml-auto font-mono text-xs text-text-muted">
        {latestMetric
          ? `${latestMetric.name}: ${Math.round(latestMetric.durationMs)}ms`
          : "No metrics yet"}
      </span>
    </div>
  );
}
