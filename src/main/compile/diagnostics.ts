import type { CompileDiagnostic } from "../../shared/domain";

export function parseDiagnostics(output: string): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];
  const fileLinePattern = /^(.+?):(\d+):\s*(.+)$/;

  for (const line of output.split(/\r?\n/)) {
    const fileLine = line.match(fileLinePattern);
    if (fileLine) {
      diagnostics.push({
        file: fileLine[1],
        line: Number(fileLine[2]),
        severity: /warning/i.test(fileLine[3]) ? "warning" : "error",
        message: fileLine[3].trim(),
      });
      continue;
    }

    if (line.startsWith("! ")) {
      diagnostics.push({
        file: null,
        line: null,
        severity: "error",
        message: line.slice(2).trim(),
      });
    } else if (/warning/i.test(line)) {
      diagnostics.push({
        file: null,
        line: null,
        severity: "warning",
        message: line.trim(),
      });
    }
  }

  return diagnostics.slice(0, 100);
}
