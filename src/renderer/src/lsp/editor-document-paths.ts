const LSP_PATH_SUFFIXES = [".tex", ".bib", ".sty", ".cls"] as const;

export function isLspEditorPath(path: string): boolean {
  return LSP_PATH_SUFFIXES.some((suffix) => path.endsWith(suffix));
}

export function languageIdForLspPath(path: string): string | null {
  if (path.endsWith(".bib")) return "bibtex";
  if (path.endsWith(".tex") || path.endsWith(".sty") || path.endsWith(".cls")) return "latex";
  return null;
}
