import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "./agent-prompt";

describe("buildAgentSystemPrompt", () => {
  it("includes compile summary instead of full diagnostic lines", () => {
    const prompt = buildAgentSystemPrompt({
      selectedFiles: ["main.tex"],
      compileSummary: "Compile: 2 errors, 0 warnings (failed, 200ms). main: main.tex",
      prompt: "Fix the error",
    });

    expect(prompt).toContain("Compile: 2 errors, 0 warnings (failed, 200ms). main: main.tex");
    expect(prompt).not.toContain("ERROR main.tex");
    expect(prompt).toContain("User request:\nFix the error");
  });

  it("includes BibTeX and static-diagnostic domain guidance", () => {
    const prompt = buildAgentSystemPrompt({
      selectedFiles: [],
      compileSummary: null,
      prompt: "Why is references.bib wrong?",
    });

    expect(prompt).toContain("static rows (Texlab)");
    expect(prompt).toContain("% is LaTeX line-comment syntax only");
    expect(prompt).toContain("@comment{ ... }");
  });
});
