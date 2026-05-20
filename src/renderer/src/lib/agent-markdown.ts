function closeOpenMarkdownFence(text: string): string {
  const fenceCount = (text.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) return `${text}\n\`\`\``;
  return text;
}

/** Wrap bare agent output in fenced blocks so Shiki can highlight LaTeX and diffs. */
export function prepareAgentMarkdown(text: string, streaming = false): string {
  const normalized = streaming ? closeOpenMarkdownFence(text) : text;

  if (!normalized.trim() || normalized.includes("```")) return normalized;

  const trimmed = normalized.trim();

  const looksLikeUnifiedDiff =
    /^diff --git /m.test(trimmed) || (/^---\s/m.test(trimmed) && /^\+\+\+\s/m.test(trimmed));

  if (looksLikeUnifiedDiff) {
    return `\`\`\`diff\n${trimmed}\n\`\`\``;
  }

  const looksLikeLatex =
    /^\\(documentclass|begin\{document\}|section\*?|chapter|usepackage|input|include)\b/m.test(
      trimmed,
    );

  if (looksLikeLatex) {
    return `\`\`\`latex\n${trimmed}\n\`\`\``;
  }

  return normalized;
}
