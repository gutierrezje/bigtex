function closeOpenMarkdownFence(text: string): string {
  const fenceCount = (text.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) return `${text}\n\`\`\``;
  return text;
}

function looksLikeStreamingDiff(text: string): boolean {
  return (
    /^diff --git /m.test(text) ||
    /^---\s/m.test(text) ||
    /^\+\+\+\s/m.test(text) ||
    /^@@\s/m.test(text) ||
    /^[-+]{3}\s/m.test(text)
  );
}

/** Wrap bare agent output in fenced blocks so Shiki can highlight LaTeX and diffs. */
export function prepareAgentMarkdown(text: string, streaming = false): string {
  let normalized = streaming ? closeOpenMarkdownFence(text) : text;

  if (streaming && !normalized.includes("```") && looksLikeStreamingDiff(normalized)) {
    normalized = `\`\`\`diff\n${normalized}\n\`\`\``;
  }

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
