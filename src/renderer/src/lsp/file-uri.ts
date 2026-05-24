/** file:// URI for LSP / Monaco (renderer-safe; no node:url). */
export function pathToFileUri(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  if (normalized.startsWith("file://")) return normalized;
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}
