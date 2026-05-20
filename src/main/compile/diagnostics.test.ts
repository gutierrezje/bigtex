import { describe, expect, it } from "vitest";
import { parseDiagnostics } from "./diagnostics";

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
});
