import type { CompileDiagnostic, CompileResult, ProjectFile } from "./domain";

export type ProblemsTab = "all" | "error" | "warning";

export function countDiagnosticsBySeverity(diagnostics: CompileDiagnostic[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

export function filterDiagnosticsByTab(
  diagnostics: CompileDiagnostic[],
  tab: ProblemsTab,
): CompileDiagnostic[] {
  if (tab === "all") return diagnostics;
  if (tab === "error") return diagnostics.filter((d) => d.severity === "error");
  return diagnostics.filter((d) => d.severity === "warning");
}

export function formatCompileSummary(
  result: Pick<CompileResult, "success" | "durationMs" | "diagnostics">,
  mainFile: string,
): string {
  const { errors, warnings } = countDiagnosticsBySeverity(result.diagnostics);
  const outcome = result.success ? "passed" : "failed";
  const errorLabel = errors === 1 ? "error" : "errors";
  const warningLabel = warnings === 1 ? "warning" : "warnings";
  return `Compile: ${errors} ${errorLabel}, ${warnings} ${warningLabel} (${outcome}, ${result.durationMs}ms). main: ${mainFile}`;
}

export function normalizeDiagnosticPath(file: string | null): string | null {
  if (!file) return null;
  return file.replace(/^\.\//, "").replace(/\\/g, "/");
}

export function formatAgentHandoffLine(diagnostic: CompileDiagnostic): string {
  const path = normalizeDiagnosticPath(diagnostic.file);
  const location = [path, diagnostic.line].filter((part) => part != null && part !== "").join(":");
  const prefix = location || "project";
  return `${prefix} — ${diagnostic.message}`;
}

export function appendAgentHandoffToComposer(current: string, handoffLine: string): string {
  const trimmed = current.trimEnd();
  if (!trimmed) return handoffLine;
  return `${trimmed}\n${handoffLine}`;
}

export function mergeAgentSelectedFiles(openFile: string | null, extraFiles: string[]): string[] {
  const merged = new Set<string>();
  if (openFile) merged.add(openFile);
  for (const file of extraFiles) {
    const normalized = normalizeDiagnosticPath(file);
    if (normalized) merged.add(normalized);
  }
  return [...merged];
}

export function findProjectFileByPath(files: ProjectFile[], path: string): ProjectFile | null {
  const target = normalizeDiagnosticPath(path);
  if (!target) return null;

  for (const file of files) {
    if (file.path === target) return file;
    if (file.children) {
      const nested = findProjectFileByPath(file.children, target);
      if (nested) return nested;
    }
  }
  return null;
}

export function diagnosticHasSource(diagnostic: CompileDiagnostic): boolean {
  return Boolean(normalizeDiagnosticPath(diagnostic.file) && diagnostic.line);
}
