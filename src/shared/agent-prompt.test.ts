import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "./agent-prompt";

describe("buildAgentSystemPrompt", () => {
  it("includes compile summary instead of full diagnostic lines", () => {
    const prompt = buildAgentSystemPrompt({
      projectName: "paper",
      activeEditorPath: "main.tex",
      activePdfPath: ".tex-build/main.pdf",
      selectedFiles: ["main.tex"],
      compileSummary: "Compile: 2 errors, 0 warnings (failed, 200ms). main: main.tex",
      prompt: "Fix the error",
    });

    expect(prompt).toContain("Compile: 2 errors, 0 warnings (failed, 200ms). main: main.tex");
    expect(prompt).not.toContain("ERROR main.tex");
    expect(prompt).toContain("Active editor file: main.tex");
    expect(prompt).toContain("Active PDF: .tex-build/main.pdf");
    expect(prompt).toContain("User request:\nFix the error");
  });

  it("includes BibTeX and static-diagnostic domain guidance", () => {
    const prompt = buildAgentSystemPrompt({
      projectName: null,
      activeEditorPath: null,
      activePdfPath: null,
      selectedFiles: [],
      compileSummary: null,
      prompt: "Why is references.bib wrong?",
    });

    expect(prompt).toContain("static rows (Texlab)");
    expect(prompt).toContain("% is LaTeX line-comment syntax only");
    expect(prompt).toContain("@comment{ ... }");
  });

  it("allows full project work while keeping compile and PDF state central", () => {
    const prompt = buildAgentSystemPrompt({
      projectName: "thesis",
      activeEditorPath: "chapters/intro.tex",
      activePdfPath: null,
      selectedFiles: ["chapters/intro.tex"],
      compileSummary: null,
      prompt: "Research the macro usage and update the draft.",
    });

    expect(prompt).toContain("full-capability project agent");
    expect(prompt).toContain("inspect files, search the project");
    expect(prompt).toContain("context hint files are starting points, not hard limits");
    expect(prompt).toContain("prefer the host app's BigTeX compile flow");
    expect(prompt).toContain("```bigtex-action");
    expect(prompt).toContain('"kind":"compile"');
    expect(prompt).toContain("You may edit files directly");
    expect(prompt).not.toContain("Do not apply changes yourself");
  });
});
