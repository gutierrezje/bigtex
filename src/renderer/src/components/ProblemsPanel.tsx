import type React from "react";
import { useMemo, useState } from "react";
import type { CompileDiagnostic, CompileResult } from "../../../shared/domain";
import {
  countDiagnosticsBySeverity,
  diagnosticHasSource,
  filterDiagnosticsByTab,
  type ProblemsTab,
} from "../../../shared/problems";

interface ProblemsPanelProps {
  result: CompileResult | null;
  onGoToSource(diagnostic: CompileDiagnostic): void;
  onAgentHandoff(diagnostic: CompileDiagnostic): void;
}

const TABS: Array<{ id: ProblemsTab; label: string }> = [
  { id: "all", label: "all" },
  { id: "error", label: "errors" },
  { id: "warning", label: "warnings" },
];

function tabCount(tab: ProblemsTab, counts: { errors: number; warnings: number }, total: number) {
  if (tab === "error") return counts.errors;
  if (tab === "warning") return counts.warnings;
  return total;
}

function ProblemActionButton({
  hint,
  disabled,
  onClick,
  children,
  accentOnHover = false,
}: {
  hint: string;
  disabled?: boolean;
  onClick(event: React.MouseEvent<HTMLButtonElement>): void;
  children: React.ReactNode;
  accentOnHover?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={hint}
      title={hint}
      disabled={disabled}
      className={`group/action relative rounded p-1 text-text-muted transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-30 ${
        accentOnHover
          ? "hover:bg-accent-muted hover:text-accent"
          : "hover:bg-surface-raised hover:text-text-secondary"
      }`}
      onClick={onClick}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden whitespace-nowrap rounded border border-border bg-surface-raised px-2 py-1 text-[10px] font-medium text-text-secondary shadow-lg group-hover/action:block group-focus-visible/action:block"
      >
        {hint}
      </span>
    </button>
  );
}

function ProblemRow({
  diagnostic,
  canNavigate,
  location,
  onGoToSource,
  onAgentHandoff,
}: {
  diagnostic: CompileDiagnostic;
  canNavigate: boolean;
  location: string;
  onGoToSource(diagnostic: CompileDiagnostic): void;
  onAgentHandoff(diagnostic: CompileDiagnostic): void;
}) {
  const rowClassName = `group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded border border-border/40 bg-surface px-2.5 py-1.5 text-left transition-colors duration-100 ${
    canNavigate
      ? "cursor-pointer hover:border-border/80 hover:bg-surface-raised/60"
      : "bg-surface-inset/30"
  }`;

  const content = (
    <>
      <div className="min-w-0">
        <p
          className={`m-0 text-xs leading-relaxed ${
            diagnostic.severity === "error" ? "text-danger" : "text-text-secondary"
          }`}
        >
          {diagnostic.message}
        </p>
        <p className="m-0 mt-0.5 font-mono text-[9px] text-text-muted/80">
          {location || "project"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        <ProblemActionButton
          hint={
            canNavigate
              ? "Go to source — open file at this line"
              : "Go to source — no file or line for this problem"
          }
          disabled={!canNavigate}
          onClick={(event) => {
            event.stopPropagation();
            if (canNavigate) onGoToSource(diagnostic);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <title>Go to source</title>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
        </ProblemActionButton>
        <ProblemActionButton
          hint="Hand off to agent — prefill composer with this problem"
          accentOnHover
          onClick={(event) => {
            event.stopPropagation();
            onAgentHandoff(diagnostic);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <title>Hand off to agent</title>
            <path d="M9.5 6.5l1.5 1.5M14.5 6.5l-1.5 1.5M12 3v2M5 10a7 7 0 1014 0" />
          </svg>
        </ProblemActionButton>
      </div>
    </>
  );

  if (canNavigate) {
    return (
      <button type="button" className={rowClassName} onClick={() => onGoToSource(diagnostic)}>
        {content}
      </button>
    );
  }

  return <div className={rowClassName}>{content}</div>;
}

export function ProblemsPanel({ result, onGoToSource, onAgentHandoff }: ProblemsPanelProps) {
  const [activeTab, setActiveTab] = useState<ProblemsTab>("all");
  const diagnostics = result?.diagnostics ?? [];
  const counts = useMemo(() => countDiagnosticsBySeverity(diagnostics), [diagnostics]);
  const visible = useMemo(
    () => filterDiagnosticsByTab(diagnostics, activeTab),
    [diagnostics, activeTab],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex gap-1 border-b border-border/40 px-2 py-1.5">
        {TABS.map((tab) => {
          const count = tabCount(tab.id, counts, diagnostics.length);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors duration-100 cursor-pointer ${
                active
                  ? "border border-accent/20 bg-accent/8 text-text-primary"
                  : "border border-transparent text-text-muted hover:text-text-secondary"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span
                className={`ml-1.5 rounded border px-1.5 py-0.5 text-[9px] ${
                  active
                    ? "bg-accent/10 text-accent border-accent/20"
                    : "bg-surface-inset text-text-muted border-border"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {visible.length ? (
          <ul className="grid gap-1">
            {visible.map((diagnostic, index) => {
              const canNavigate = diagnosticHasSource(diagnostic);
              const location = [diagnostic.file, diagnostic.line].filter(Boolean).join(":");
              return (
                <li key={`${diagnostic.message}-${location}-${index}`}>
                  <ProblemRow
                    diagnostic={diagnostic}
                    canNavigate={canNavigate}
                    location={location}
                    onGoToSource={onGoToSource}
                    onAgentHandoff={onAgentHandoff}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-1 text-xs text-text-muted">
            {result?.success
              ? "No problems. The current PDF is ready."
              : result
                ? "No problems in this filter."
                : "Compile to see errors and warnings here."}
          </p>
        )}
      </div>
    </div>
  );
}
