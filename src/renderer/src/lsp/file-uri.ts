/** file:// URI for LSP / Monaco (renderer-safe; no node:url). */
export function pathToFileUri(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, "/");
  if (normalized.startsWith("file://")) return normalized;
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`;
}

/** Project-relative path from a model URI under `rootPath`, or null if outside the project. */
export function fileUriToProjectRelativePath(fileUri: string, rootPath: string): string | null {
  const root = pathToFileUri(rootPath).replace(/\/$/, "");
  const uri = fileUri.replace(/\\/g, "/");
  if (uri === root) return null;
  const prefix = `${root}/`;
  if (!uri.startsWith(prefix)) return null;
  return uri.slice(prefix.length).replace(/^\.\//, "");
}
