import type { CompilerKind, PerformanceMark } from "../../../shared/domain";

interface CommandBarProps {
  compiler: CompilerKind;
  metrics: PerformanceMark[];
  onCompilerChange(compiler: CompilerKind): void;
  onRefreshMetrics(): void;
  showSidebar: boolean;
  onToggleSidebar(): void;
  showDiagnostics: boolean;
  onToggleDiagnostics(): void;
  showPdf: boolean;
  onTogglePdf(): void;
  showAgent: boolean;
  onToggleAgent(): void;
}

export function CommandBar({
  compiler,
  metrics,
  onCompilerChange,
  onRefreshMetrics,
  showSidebar,
  onToggleSidebar,
  showDiagnostics,
  onToggleDiagnostics,
  showPdf,
  onTogglePdf,
  showAgent,
  onToggleAgent,
}: CommandBarProps) {
  const latestMetric = metrics.at(-1);

  return (
    <div
      className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-zinc-950 px-4 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left traffic-light safety spacing */}
      <div className="w-20 shrink-0" />

      {/* Center/Left: Compiler selectors and metrics */}
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
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

        <span className="font-mono text-xs text-text-muted select-none">
          {latestMetric
            ? `${latestMetric.name}: ${Math.round(latestMetric.durationMs)}ms`
            : "No metrics yet"}
        </span>
      </div>

      {/* Right: Panel Toggles */}
      <div
        className="flex items-center gap-1 bg-zinc-900/60 p-0.5 rounded-md border border-border/40"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          title="Toggle Sidebar (Files)"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showSidebar
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
          onClick={onToggleSidebar}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <title>Toggle Sidebar</title>
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>

        <button
          type="button"
          title="Toggle Console (Diagnostics)"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showDiagnostics
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
          onClick={onToggleDiagnostics}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <title>Toggle Diagnostics</title>
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 15h18" />
            <path d="m8 9 2 2-2 2" />
          </svg>
        </button>

        <button
          type="button"
          title="Toggle PDF Previewer"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showPdf
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
          onClick={onTogglePdf}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <title>Toggle PDF Preview</title>
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 9H8" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
          </svg>
        </button>

        <button
          type="button"
          title="Toggle AI Agent Panel"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showAgent
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
          onClick={onToggleAgent}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <title>Toggle AI Agent</title>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z" opacity="0.6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
