import { describe, expect, it } from "vitest";
import { prepareAgentMarkdown } from "./agent-markdown";

describe("prepareAgentMarkdown", () => {
  it("balances fences while streaming and wraps bare diffs/LaTeX only when needed", () => {
    const streaming = prepareAgentMarkdown("```latex\n\\section{}", true);
    expect(streaming.endsWith("```")).toBe(true);
    expect((streaming.match(/```/g) ?? []).length % 2).toBe(0);

    const diff = "--- a/main.tex\n+++ b/main.tex\n@@ -1 +1 @@";
    expect(prepareAgentMarkdown(diff)).toBe(`\`\`\`diff\n${diff}\n\`\`\``);

    const latex = "\\documentclass{article}\n\\begin{document}";
    expect(prepareAgentMarkdown(latex)).toBe(`\`\`\`latex\n${latex}\n\`\`\``);

    const fenced = "```diff\n--- a\n+++ b\n```";
    expect(prepareAgentMarkdown(fenced)).toBe(fenced);

    const partialDiff = "--- a/main.tex\n+++ b/main.tex\n@@ -1";
    expect(prepareAgentMarkdown(partialDiff, true)).toBe(
      "```diff\n--- a/main.tex\n+++ b/main.tex\n@@ -1\n```",
    );
  });
});
