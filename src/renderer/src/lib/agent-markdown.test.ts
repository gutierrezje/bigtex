import { describe, expect, it } from "vitest";
import { prepareAgentMarkdown } from "./agent-markdown";

describe("prepareAgentMarkdown", () => {
  it("closes an open fence while streaming", () => {
    const result = prepareAgentMarkdown("```latex\n\\section{}", true);
    expect(result.endsWith("```")).toBe(true);
    expect((result.match(/```/g) ?? []).length % 2).toBe(0);
  });

  it("wraps unified diffs in diff fences", () => {
    const diff = "--- a/main.tex\n+++ b/main.tex\n@@ -1 +1 @@";
    expect(prepareAgentMarkdown(diff)).toBe(`\`\`\`diff\n${diff}\n\`\`\``);
  });

  it("wraps bare LaTeX in latex fences", () => {
    const latex = "\\documentclass{article}\n\\begin{document}";
    expect(prepareAgentMarkdown(latex)).toBe(`\`\`\`latex\n${latex}\n\`\`\``);
  });

  it("leaves already-fenced markdown unchanged", () => {
    const text = "```diff\n--- a\n+++ b\n```";
    expect(prepareAgentMarkdown(text)).toBe(text);
  });
});
