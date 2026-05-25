import { useMemo, useState } from "react";
import type { CompileDiagnostic, CompileResult } from "../../../shared/domain";
import {
  countDiagnosticsBySeverity,
  diagnosticHasSource,
  filterDiagnosticsByTab,
  type ProblemsTab,
} from "../../../shared/problems";
import { CHROME_META_CLASS } from "../lib/treeTypography";
import { IconTooltipButton } from "./IconTooltipButton";

interface ProblemsPanelProps {
  compileResult: CompileResult | null;
  diagnostics: CompileDiagnostic[];
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

const PROBLEM_ACTION_CLASS =
  "rounded p-1 text-text-muted transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-30";

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
  const rowClassName = `group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded border border-border/40 px-2.5 py-1.5 text-left transition-colors duration-100 ${
    canNavigate
      ? "cursor-pointer bg-surface-raised hover:border-border/80 hover:bg-border-subtle"
      : "bg-surface-raised/40"
  }`;

  const messageClassName = `min-w-0 ${canNavigate ? "cursor-pointer text-left" : ""}`;
  const message = (
    <>
      <p
        className={`m-0 ${CHROME_META_CLASS} ${
          diagnostic.severity === "error" ? "text-danger" : "text-text-secondary"
        }`}
      >
        {diagnostic.source ? (
          <span
            className={`mr-1.5 inline-flex rounded border px-1 py-px font-medium uppercase tracking-wide ${
              diagnostic.source === "compile"
                ? "border-border bg-surface-inset text-text-muted"
                : "border-accent/25 bg-accent/8 text-accent"
            }`}
          >
            {diagnostic.source}
          </span>
        ) : null}
        {diagnostic.message}
      </p>
      <p className={`m-0 mt-0.5 font-mono ${CHROME_META_CLASS} text-text-muted/80`}>
        {location || "project"}
      </p>
    </>
  );

  return (
    <div className={rowClassName}>
      {canNavigate ? (
        <button
          type="button"
          className={`${messageClassName} border-0 bg-transparent p-0`}
          onClick={() => onGoToSource(diagnostic)}
        >
          {message}
        </button>
      ) : (
        <div className={messageClassName}>{message}</div>
      )}
      <div className="flex shrink-0 items-center gap-1 pt-0.5">
        <IconTooltipButton
          hint={
            canNavigate
              ? "Go to source — open file at this line"
              : "Go to source — no file or line for this problem"
          }
          tooltipPlacement="below"
          disabled={!canNavigate}
          className={`${PROBLEM_ACTION_CLASS} hover:bg-surface-raised hover:text-text-secondary`}
          onClick={() => {
            if (canNavigate) onGoToSource(diagnostic);
          }}
        >
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative; parent button has aria-label */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          </svg>
        </IconTooltipButton>
        <IconTooltipButton
          hint="Hand off to agent — prefill composer with this problem"
          tooltipPlacement="below"
          className={`${PROBLEM_ACTION_CLASS} hover:bg-accent-muted hover:text-accent`}
          onClick={() => onAgentHandoff(diagnostic)}
        >
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative; parent button has aria-label */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M9.5 6.5l1.5 1.5M14.5 6.5l-1.5 1.5M12 3v2M5 10a7 7 0 1014 0" />
          </svg>
        </IconTooltipButton>
      </div>
    </div>
  );
}

export function ProblemsPanel({
  compileResult,
  diagnostics,
  onGoToSource,
  onAgentHandoff,
}: ProblemsPanelProps) {
  const [activeTab, setActiveTab] = useState<ProblemsTab>("all");
  const counts = useMemo(() => countDiagnosticsBySeverity(diagnostics), [diagnostics]);
  const visible = useMemo(
    () => filterDiagnosticsByTab(diagnostics, activeTab),
    [diagnostics, activeTab],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border/40 px-2 py-1.5">
        {TABS.map((tab) => {
          const count = tabCount(tab.id, counts, diagnostics.length);
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`inline-flex h-7 items-center gap-1.5 rounded border px-2 text-[13px] leading-none transition-colors duration-100 cursor-pointer ${
                active
                  ? "border-accent/20 bg-accent/8 text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 text-[11px] font-medium tabular-nums leading-none ${
                  active
                    ? "border-accent/20 bg-accent/10 text-accent"
                    : "border-border bg-surface-inset text-text-muted"
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
                <li
                  key={`${diagnostic.source ?? "row"}-${diagnostic.message}-${location}-${index}`}
                >
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
          <p className={`px-1 ${CHROME_META_CLASS} text-text-muted`}>
            {compileResult?.success && diagnostics.length === 0
              ? "No problems. The current PDF is ready."
              : diagnostics.length === 0
                ? "Compile to see build errors here, or open a LaTeX file for static checks."
                : "No problems in this filter."}
          </p>
        )}
      </div>
    </div>
  );
}
