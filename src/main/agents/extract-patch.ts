const PATCH_BLOCK_PATTERN = /```(?:diff|patch)\s*\n([\s\S]*?)```/gi;

/** Pull unified diffs from fenced ```diff / ```patch blocks in agent transcripts. */
export function extractPatch(text: string): string | null {
  const patches: string[] = [];
  for (const match of text.matchAll(PATCH_BLOCK_PATTERN)) {
    patches.push(match[1].trim());
  }
  return patches.length > 0 ? patches.join("\n\n") : null;
}
