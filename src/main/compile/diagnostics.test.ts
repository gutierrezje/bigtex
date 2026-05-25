import { describe, expect, it } from "vitest";
import {
  mergeCompileDiagnostics,
  normalizeCompileDiagnosticPath,
  parseDiagnostics,
  parseDiagnosticsFromLog,
  resolveCompileDiagnostics,
  resolveCompileLogPath,
} from "./diagnostics";

const WORKSHOP_LOG_EXCERPT = `
 (./chapters/intro.tex

LaTeX Warning: Reference \`sec:introduction' on page 1 undefined on input line 3.

) (./chapters/layout.tex

Overfull \\hbox (194.10962pt too wide) in paragraph at lines 6--7

LaTeX Warning: Reference \`fig:missing' on page 2 undefined on input line 26.

) (./chapters/references.tex
) (./chapters/math.tex
./chapters/math.tex:6: Missing $ inserted.
<inserted text>
l.6 The expression a_2 + b^2 should be wrapped as $a_2 + b^2$.
./chapters/math.tex:6: Missing $ inserted.
l.6 ...pression a_2 + b^2 should be wrapped as $a_
`;

const SPARSE_CONSOLE = `
Latexmk: Nothing to do for 'main.tex'.
Latexmk: All targets (.tex-build/main.pdf) are up-to-date
Collected error summary (may duplicate other messages):
  pdflatex: gave an error in previous invocation of latexmk.
`;

describe("normalizeCompileDiagnosticPath", () => {
  it("strips ./ and .tex-build/ prefixes", () => {
    expect(normalizeCompileDiagnosticPath("./chapters/math.tex")).toBe("chapters/math.tex");
    expect(normalizeCompileDiagnosticPath(".tex-build/main.tex")).toBe("main.tex");
  });
});

describe("resolveCompileLogPath", () => {
  it("points at the build-dir log for the main file stem", () => {
    expect(resolveCompileLogPath("/proj", "main.tex")).toBe("/proj/.tex-build/main.log");
    expect(resolveCompileLogPath("/proj", "papers/thesis.tex")).toBe("/proj/.tex-build/thesis.log");
  });
});

describe("parseDiagnostics", () => {
  it("parses compiler lines, bang errors, warnings, and caps volume", () => {
    expect(parseDiagnostics("main.tex:12: Undefined control sequence \\foo\n")).toEqual([
      {
        file: "main.tex",
        line: 12,
        severity: "error",
        message: "Undefined control sequence \\foo",
      },
    ]);

    const noisy = "! Emergency stop.\nLaTeX Warning: Reference `fig:1' undefined\n";
    const parsed = parseDiagnostics(noisy);
    expect(parsed[0]).toMatchObject({ severity: "error", message: "Emergency stop." });
    expect(parsed[1]).toMatchObject({ severity: "warning" });

    const longRun = Array.from(
      { length: 120 },
      (_, index) => `file${index}.tex:1: error ${index}`,
    ).join("\n");
    expect(parseDiagnostics(longRun)).toHaveLength(100);
  });

  it("normalizes paths when rootPath is provided", () => {
    const parsed = parseDiagnostics("./chapters/a.tex:1: error x", "/proj");
    expect(parsed[0]?.file).toBe("chapters/a.tex");
  });
});

describe("parseDiagnosticsFromLog", () => {
  it("extracts file:line errors and contextual LaTeX warnings from a log", () => {
    const parsed = parseDiagnosticsFromLog(WORKSHOP_LOG_EXCERPT, {
      rootPath: "/proj",
    });

    expect(parsed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "chapters/math.tex",
          line: 6,
          severity: "error",
          message: "Missing $ inserted.",
        }),
        expect.objectContaining({
          file: "chapters/intro.tex",
          line: 3,
          severity: "warning",
        }),
        expect.objectContaining({
          file: "chapters/layout.tex",
          line: 26,
          severity: "warning",
        }),
      ]),
    );

    const mathErrors = parsed.filter(
      (d) => d.file === "chapters/math.tex" && d.message === "Missing $ inserted.",
    );
    expect(mathErrors).toHaveLength(1);
  });

  it("maps package warnings (e.g. refcheck) to the current input file", () => {
    const log = `
 (./chapters/intro.tex

Package refcheck Warning: Unused label \`sec:duplicate' on input line 8.

) (./chapters/layout.tex
`;
    const parsed = parseDiagnosticsFromLog(log, { rootPath: "/proj" });
    expect(parsed).toEqual([
      expect.objectContaining({
        file: "chapters/intro.tex",
        line: 8,
        severity: "warning",
        message: expect.stringContaining("sec:duplicate"),
      }),
    ]);
  });

  it("maps overfull hbox warnings to the current input file", () => {
    const parsed = parseDiagnosticsFromLog(WORKSHOP_LOG_EXCERPT, { rootPath: "/proj" });
    expect(parsed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "chapters/layout.tex",
          line: 6,
          severity: "warning",
          message: expect.stringContaining("Overfull \\hbox"),
        }),
      ]),
    );
  });
});

describe("mergeCompileDiagnostics", () => {
  it("dedupes identical issues and prefers log entries", () => {
    const consoleDiag = [
      {
        file: "chapters/math.tex",
        line: 6,
        severity: "error" as const,
        message: "Missing $ inserted.",
      },
    ];
    const logDiag = [
      {
        file: "chapters/math.tex",
        line: 6,
        severity: "error" as const,
        message: "Missing $ inserted.",
      },
      {
        file: "chapters/intro.tex",
        line: 3,
        severity: "warning" as const,
        message: "Reference `sec:introduction' on page 1 undefined",
      },
    ];

    expect(mergeCompileDiagnostics(consoleDiag, logDiag)).toHaveLength(2);
  });
});

describe("resolveCompileDiagnostics", () => {
  it("fills sparse console output from the log on repeat compiles", () => {
    const merged = resolveCompileDiagnostics(SPARSE_CONSOLE, WORKSHOP_LOG_EXCERPT, {
      rootPath: "/proj",
    });

    expect(merged.length).toBeGreaterThan(1);
    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "chapters/math.tex", line: 6, severity: "error" }),
      ]),
    );
    expect(merged.some((d) => d.message.includes("Compiler exited with code"))).toBe(false);
  });

  it("returns empty when console and log are clean", () => {
    expect(resolveCompileDiagnostics("", "")).toEqual([]);
  });
});
