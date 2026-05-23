import type { CompileDiagnostic, CompileResult } from "../../../shared/domain";
import { OutputPanel } from "./OutputPanel";
import { ProblemsPanel } from "./ProblemsPanel";

export type EditorBottomTab = "problems" | "output";

interface EditorBottomPanelProps {
  activeTab: EditorBottomTab;
  onTabChange(tab: EditorBottomTab): void;
  onOutputTabSelect?(): void;
  result: CompileResult | null;
  compiling: boolean;
  onCompile(): void;
  onGoToSource(diagnostic: CompileDiagnostic): void;
  onAgentHandoff(diagnostic: CompileDiagnostic): void;
}

export function EditorBottomPanel({
  activeTab,
  onTabChange,
  onOutputTabSelect,
  result,
  compiling,
  onCompile,
  onGoToSource,
  onAgentHandoff,
}: EditorBottomPanelProps) {
  const problemTotal = result?.diagnostics.length ?? 0;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-raised">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-2 py-1 select-none">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          <BottomTabButton
            active={activeTab === "problems"}
            label="problems"
            count={problemTotal}
            onClick={() => onTabChange("problems")}
          />
          <BottomTabButton
            active={activeTab === "output"}
            label="output"
            onClick={() => {
              onTabChange("output");
              onOutputTabSelect?.();
            }}
          />
        </div>
        <span className="hidden shrink-0 truncate text-[10px] text-text-muted sm:inline mr-2">
          {result
            ? `${result.success ? "clean" : "needs attention"} · ${result.durationMs}ms`
            : "not run"}
        </span>
        <button
          type="button"
          className="shrink-0 rounded border border-border px-2.5 py-0.5 text-[11px] font-medium text-text-muted transition-colors duration-100 hover:border-accent/30 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer bg-surface-inset/40"
          onClick={onCompile}
          disabled={compiling}
        >
          {compiling ? "compiling..." : "compile"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "problems" ? (
          <ProblemsPanel
            result={result}
            onGoToSource={onGoToSource}
            onAgentHandoff={onAgentHandoff}
          />
        ) : (
          <OutputPanel />
        )}
      </div>
    </section>
  );
}

function BottomTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      className={`rounded-t border-b-2 px-3 py-1.5 text-[11px] font-medium transition-colors duration-100 cursor-pointer ${
        active
          ? "border-accent text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      }`}
      onClick={onClick}
    >
      {label}
      {count != null && count > 0 ? (
        <span
          className={`ml-1.5 rounded border px-1.5 py-0.5 text-[9px] ${
            active
              ? "bg-accent/10 text-accent border-accent/20"
              : "bg-surface-inset text-text-muted border-border"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
