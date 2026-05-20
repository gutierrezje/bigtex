import { describe, expect, it } from "vitest";
import { parseDiagnostics } from "./diagnostics";

describe("parseDiagnostics", () => {
  it("parses file:line messages", () => {
    const output = "main.tex:12: Undefined control sequence \\foo\n";
    expect(parseDiagnostics(output)).toEqual([
      {
        file: "main.tex",
        line: 12,
        severity: "error",
        message: "Undefined control sequence \\foo",
      },
    ]);
  });

  it("parses LaTeX bang errors and warnings", () => {
    const output = "! Emergency stop.\nLaTeX Warning: Reference `fig:1' undefined\n";
    const diagnostics = parseDiagnostics(output);
    expect(diagnostics[0]).toMatchObject({
      severity: "error",
      message: "Emergency stop.",
    });
    expect(diagnostics[1]).toMatchObject({
      severity: "warning",
    });
  });

  it("caps output at 100 entries", () => {
    const lines = Array.from({ length: 120 }, (_, index) => `file${index}.tex:1: error ${index}`);
    expect(parseDiagnostics(lines.join("\n"))).toHaveLength(100);
  });
});
