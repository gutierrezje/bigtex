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
  { id: "all", label: "All" },
  { id: "error", label: "Errors" },
  { id: "warning", label: "Warnings" },
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
          : "hover:bg-zinc-800 hover:text-text-secondary"
      }`}
      onClick={onClick}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden whitespace-nowrap rounded-md border border-border bg-zinc-900 px-2 py-1 text-[10px] font-medium text-text-secondary shadow-lg group-hover/action:block group-focus-visible/action:block"
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
  const rowClassName = `group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors duration-100 ${
    canNavigate
      ? "cursor-pointer hover:border-border-subtle hover:bg-zinc-900/60"
      : "bg-zinc-900/40"
  }`;

  const content = (
    <>
      <div className="min-w-0">
        <p
          className={`m-0 text-xs leading-relaxed ${
            diagnostic.severity === "error" ? "text-danger" : "text-accent"
          }`}
        >
          {diagnostic.message}
        </p>
        <p className="m-0 mt-0.5 font-mono text-[10px] text-text-muted">{location || "project"}</p>
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
      <div className="flex gap-1 border-b border-border-subtle px-2 py-1.5">
        {TABS.map((tab) => {
          const count = tabCount(tab.id, counts, diagnostics.length);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors duration-100 ${
                active
                  ? "border border-accent/30 bg-accent-muted text-accent"
                  : "border border-transparent text-text-muted hover:text-text-secondary"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? "bg-accent/20 text-accent" : "bg-zinc-800 text-text-muted"
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
