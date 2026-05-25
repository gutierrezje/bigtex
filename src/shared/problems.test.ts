import { describe, expect, it } from "vitest";
import type { CompileDiagnostic, CompileResult, ProjectFile } from "./domain";
import {
  appendAgentHandoffToComposer,
  diagnosticHasSource,
  filterDiagnosticsByTab,
  findProjectFileByPath,
  formatAgentHandoffLine,
  formatCompileSummary,
  mergeAgentSelectedFiles,
  mergeProblemDiagnostics,
} from "./problems";

describe("formatCompileSummary", () => {
  it("formats counts, outcome, duration, and main file", () => {
    const result: Pick<CompileResult, "success" | "durationMs" | "diagnostics"> = {
      success: false,
      durationMs: 412,
      diagnostics: [
        { file: "a.tex", line: 1, severity: "error", message: "boom" },
        { file: "a.tex", line: 2, severity: "error", message: "boom2" },
        { file: "b.tex", line: 3, severity: "warning", message: "warn" },
      ],
    };

    expect(formatCompileSummary(result, "main.tex")).toBe(
      "Compile: 2 errors, 1 warning (failed, 412ms). main: main.tex",
    );
  });

  it("reports a clean compile with zero counts", () => {
    const result: Pick<CompileResult, "success" | "durationMs" | "diagnostics"> = {
      success: true,
      durationMs: 90,
      diagnostics: [],
    };

    expect(formatCompileSummary(result, "doc.tex")).toBe(
      "Compile: 0 errors, 0 warnings (passed, 90ms). main: doc.tex",
    );
  });
});

describe("formatAgentHandoffLine", () => {
  it("uses path:line and message in minimal form", () => {
    expect(
      formatAgentHandoffLine({
        file: "./resume.cls",
        line: 111,
        severity: "error",
        message: "LaTeX Error: Missing \\begin{document}.",
      }),
    ).toBe("resume.cls:111 — LaTeX Error: Missing \\begin{document}.");
  });

  it("labels static .bib handoffs and explains BibTeX comments", () => {
    expect(
      formatAgentHandoffLine({
        file: "references.bib",
        line: 10,
        severity: "error",
        message: 'Expecting a curly bracket: "}"',
        source: "static",
      }),
    ).toBe(
      'references.bib:10 (static/Texlab) — Expecting a curly bracket: "}" BibTeX note: % is not a comment in .bib files; use @comment{...} or prose outside @entries.',
    );
  });

  it("labels compile handoffs without BibTeX note", () => {
    expect(
      formatAgentHandoffLine({
        file: "references.bib",
        line: 3,
        severity: "error",
        message: "I found no \\citation commands",
        source: "compile",
      }),
    ).toBe("references.bib:3 (compile) — I found no \\citation commands");
  });
});

describe("appendAgentHandoffToComposer", () => {
  it("appends when composer already has text", () => {
    expect(appendAgentHandoffToComposer("Fix the intro", "resume.cls:2 — warn")).toBe(
      "Fix the intro\nresume.cls:2 — warn",
    );
  });

  it("replaces empty composer with the handoff line", () => {
    expect(appendAgentHandoffToComposer("  ", "main.tex:1 — err")).toBe("main.tex:1 — err");
  });
});

describe("mergeAgentSelectedFiles", () => {
  it("unions open file with normalized diagnostic paths", () => {
    expect(mergeAgentSelectedFiles("intro.tex", ["./resume.cls", "resume.cls"])).toEqual([
      "intro.tex",
      "resume.cls",
    ]);
  });
});

describe("findProjectFileByPath", () => {
  const tree: ProjectFile[] = [
    {
      name: "resume.cls",
      path: "resume.cls",
      absolutePath: "/proj/resume.cls",
      kind: "style",
    },
    {
      name: "src",
      path: "src",
      absolutePath: "/proj/src",
      kind: "folder",
      children: [
        {
          name: "main.tex",
          path: "src/main.tex",
          absolutePath: "/proj/src/main.tex",
          kind: "tex",
        },
      ],
    },
  ];

  it("normalizes ./ prefix and finds nested paths", () => {
    expect(findProjectFileByPath(tree, "./resume.cls")?.path).toBe("resume.cls");
    expect(findProjectFileByPath(tree, "src/main.tex")?.path).toBe("src/main.tex");
  });
});

describe("diagnosticHasSource", () => {
  it("requires file and line", () => {
    expect(diagnosticHasSource({ file: "a.tex", line: 1, severity: "error", message: "x" })).toBe(
      true,
    );
    expect(diagnosticHasSource({ file: null, line: null, severity: "error", message: "x" })).toBe(
      false,
    );
  });
});

describe("mergeProblemDiagnostics", () => {
  it("tags compile and static rows and lists compile first", () => {
    const merged = mergeProblemDiagnostics(
      [{ file: "main.tex", line: 1, severity: "error", message: "build failed" }],
      [{ file: "intro.tex", line: 2, severity: "warning", message: "undefined ref" }],
    );
    expect(merged).toEqual([
      {
        file: "main.tex",
        line: 1,
        severity: "error",
        message: "build failed",
        source: "compile",
      },
      {
        file: "intro.tex",
        line: 2,
        severity: "warning",
        message: "undefined ref",
        source: "static",
      },
    ]);
  });
});

describe("filterDiagnosticsByTab", () => {
  const diagnostics: CompileDiagnostic[] = [
    { file: "a.tex", line: 1, severity: "error", message: "e" },
    { file: "b.tex", line: 2, severity: "warning", message: "w" },
  ];

  it("filters errors and warnings tabs", () => {
    expect(filterDiagnosticsByTab(diagnostics, "error")).toHaveLength(1);
    expect(filterDiagnosticsByTab(diagnostics, "warning")).toHaveLength(1);
    expect(filterDiagnosticsByTab(diagnostics, "all")).toHaveLength(2);
  });
});
