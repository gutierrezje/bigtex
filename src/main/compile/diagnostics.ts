import { basename, join } from "node:path";
import type { CompileDiagnostic } from "../../shared/domain";
import { LATEX_BUILD_DIR } from "../../shared/latexArtifacts";
import { normalizeDiagnosticPath } from "../../shared/problems";

const MAX_DIAGNOSTICS = 100;

const FILE_LINE_PATTERN = /^(.+?):(\d+):\s*(.+)$/;
const INPUT_FILE_PATTERN = /\(\.?\/([^)\s]+\.(?:tex|bib|sty|cls))/;
const LATEX_WARNING_LINE_PATTERN = /^LaTeX Warning:\s*(.+?)\s+on input line (\d+)\.?$/i;
const PACKAGE_WARNING_LINE_PATTERN = /^Package\s+\S+\s+Warning:\s*(.+?)\s+on input line (\d+)\.?$/i;
const OVERFULL_HBOX_PATTERN = /^Overfull \\hbox.*\sin paragraph at lines (\d+)(?:--(\d+))?/i;

export function resolveCompileLogPath(rootPath: string, mainFile: string): string {
  const stem = basename(mainFile, ".tex");
  return join(rootPath, LATEX_BUILD_DIR, `${stem}.log`);
}

export function normalizeCompileDiagnosticPath(
  file: string | null,
  rootPath?: string,
): string | null {
  if (!file) return null;

  let normalized = file.replace(/\\/g, "/").trim();
  if (normalized.startsWith("./")) normalized = normalized.slice(2);

  const buildPrefix = `${LATEX_BUILD_DIR}/`;
  if (normalized.startsWith(buildPrefix)) normalized = normalized.slice(buildPrefix.length);

  if (rootPath && normalized.startsWith("/")) {
    const root = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
    const abs = normalized;
    if (abs === root || abs.startsWith(`${root}/`)) {
      normalized = abs.slice(root.length + 1);
    }
  }

  return normalizeDiagnosticPath(normalized) ?? normalized;
}

/** True when the path refers to a user project source, not TeX Live / absolute vendor files. */
export function isProjectCompileSourcePath(file: string | null, rootPath?: string): boolean {
  if (!file) return false;
  const raw = file.replace(/\\/g, "/");
  if (/texmf-dist|\/texlive\//i.test(raw)) return false;

  const normalized = normalizeCompileDiagnosticPath(file, rootPath);
  if (!normalized) return false;
  if (normalized.startsWith("/")) return false;
  return true;
}

function diagnosticKey(diagnostic: CompileDiagnostic): string {
  const file = normalizeCompileDiagnosticPath(diagnostic.file) ?? "";
  return `${diagnostic.severity}|${file}|${diagnostic.line ?? ""}|${diagnostic.message}`;
}

/** Union console + log; log entries win when file/line/message match. */
export function mergeCompileDiagnostics(
  consoleDiagnostics: CompileDiagnostic[],
  logDiagnostics: CompileDiagnostic[],
): CompileDiagnostic[] {
  const merged = new Map<string, CompileDiagnostic>();
  for (const diagnostic of consoleDiagnostics) {
    merged.set(diagnosticKey(diagnostic), diagnostic);
  }
  for (const diagnostic of logDiagnostics) {
    merged.set(diagnosticKey(diagnostic), diagnostic);
  }
  return [...merged.values()].slice(0, MAX_DIAGNOSTICS);
}

function pushDiagnostic(
  diagnostics: CompileDiagnostic[],
  diagnostic: CompileDiagnostic,
  rootPath?: string,
): void {
  if (diagnostics.length >= MAX_DIAGNOSTICS) return;
  if (diagnostic.file && !isProjectCompileSourcePath(diagnostic.file, rootPath)) return;
  diagnostics.push({
    ...diagnostic,
    file: normalizeCompileDiagnosticPath(diagnostic.file, rootPath),
  });
}

export function parseDiagnostics(output: string, rootPath?: string): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];

  for (const line of output.split(/\r?\n/)) {
    const fileLine = line.match(FILE_LINE_PATTERN);
    if (fileLine) {
      pushDiagnostic(
        diagnostics,
        {
          file: fileLine[1],
          line: Number(fileLine[2]),
          severity: /warning/i.test(fileLine[3]) ? "warning" : "error",
          message: fileLine[3].trim(),
        },
        rootPath,
      );
      continue;
    }

    if (line.startsWith("! ")) {
      pushDiagnostic(
        diagnostics,
        {
          file: null,
          line: null,
          severity: "error",
          message: line.slice(2).trim(),
        },
        rootPath,
      );
    } else if (
      /warning/i.test(line) &&
      !/Font Info|Info:/i.test(line) &&
      !PACKAGE_WARNING_LINE_PATTERN.test(line)
    ) {
      pushDiagnostic(
        diagnostics,
        {
          file: null,
          line: null,
          severity: "warning",
          message: line.trim(),
        },
        rootPath,
      );
    }
  }

  return diagnostics;
}

export function parseDiagnosticsFromLog(
  logText: string,
  options?: { rootPath?: string; mainFile?: string },
): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];
  const rootPath = options?.rootPath;
  const mainFile = options?.mainFile
    ? normalizeCompileDiagnosticPath(options.mainFile, rootPath)
    : null;
  let currentFile: string | null = null;
  const projectFileStack: string[] = [];
  let pendingErrorMessage: string | null = null;

  const activeProjectFile = (): string | null => {
    const top = projectFileStack[projectFileStack.length - 1];
    if (top) return top;
    if (currentFile && isProjectCompileSourcePath(currentFile, rootPath)) {
      return normalizeCompileDiagnosticPath(currentFile, rootPath);
    }
    return mainFile;
  };

  const trackInputFile = (rawPath: string): void => {
    currentFile = rawPath;
    if (!isProjectCompileSourcePath(rawPath, rootPath)) return;
    const normalized = normalizeCompileDiagnosticPath(rawPath, rootPath);
    if (normalized) projectFileStack.push(normalized);
  };

  for (const line of logText.split(/\r?\n/)) {
    if (/^\s*\)\s*$/.test(line)) {
      projectFileStack.pop();
    }

    const inputMatch = line.match(INPUT_FILE_PATTERN);
    if (inputMatch) {
      trackInputFile(inputMatch[1]);
    }

    const fileLine = line.match(FILE_LINE_PATTERN);
    if (fileLine) {
      pendingErrorMessage = null;
      trackInputFile(fileLine[1]);
      pushDiagnostic(
        diagnostics,
        {
          file: fileLine[1],
          line: Number(fileLine[2]),
          severity: /warning/i.test(fileLine[3]) ? "warning" : "error",
          message: fileLine[3].trim(),
        },
        rootPath,
      );
      continue;
    }

    const contextualFile = activeProjectFile();

    const latexWarning = line.match(LATEX_WARNING_LINE_PATTERN);
    if (latexWarning && contextualFile) {
      pendingErrorMessage = null;
      pushDiagnostic(
        diagnostics,
        {
          file: contextualFile,
          line: Number(latexWarning[2]),
          severity: "warning",
          message: latexWarning[1].trim(),
        },
        rootPath,
      );
      continue;
    }

    const packageWarning = line.match(PACKAGE_WARNING_LINE_PATTERN);
    if (packageWarning && contextualFile) {
      pendingErrorMessage = null;
      pushDiagnostic(
        diagnostics,
        {
          file: contextualFile,
          line: Number(packageWarning[2]),
          severity: "warning",
          message: line.trim(),
        },
        rootPath,
      );
      continue;
    }

    const overfull = line.match(OVERFULL_HBOX_PATTERN);
    if (overfull && contextualFile) {
      pushDiagnostic(
        diagnostics,
        {
          file: contextualFile,
          line: Number(overfull[1]),
          severity: "warning",
          message: line.trim(),
        },
        rootPath,
      );
      continue;
    }

    if (line.startsWith("! ")) {
      pendingErrorMessage = line.slice(2).trim();
      const lineMatch = line.match(/^l\.(\d+)\s/);
      if (lineMatch && contextualFile) {
        pushDiagnostic(
          diagnostics,
          {
            file: contextualFile,
            line: Number(lineMatch[1]),
            severity: "error",
            message: pendingErrorMessage,
          },
          rootPath,
        );
        pendingErrorMessage = null;
      }
      continue;
    }

    const texLine = line.match(/^l\.(\d+)\s/);
    if (texLine && pendingErrorMessage && contextualFile) {
      pushDiagnostic(
        diagnostics,
        {
          file: contextualFile,
          line: Number(texLine[1]),
          severity: "error",
          message: pendingErrorMessage,
        },
        rootPath,
      );
      pendingErrorMessage = null;
    }
  }

  return dedupeDiagnostics(diagnostics);
}

function dedupeDiagnostics(diagnostics: CompileDiagnostic[]): CompileDiagnostic[] {
  const merged = new Map<string, CompileDiagnostic>();
  for (const diagnostic of diagnostics) {
    merged.set(diagnosticKey(diagnostic), diagnostic);
  }
  return [...merged.values()].slice(0, MAX_DIAGNOSTICS);
}

export function resolveCompileDiagnostics(
  output: string,
  logText: string | null,
  options?: { rootPath?: string; mainFile?: string },
): CompileDiagnostic[] {
  const rootPath = options?.rootPath;
  const consoleDiagnostics = parseDiagnostics(output, rootPath);
  const logDiagnostics = logText
    ? parseDiagnosticsFromLog(logText, { rootPath, mainFile: options?.mainFile })
    : [];
  return mergeCompileDiagnostics(consoleDiagnostics, logDiagnostics);
}
