/** Monaco / vscode-languageclient filters for Texlab (matches editor-document-paths). */
export const TEXLAB_DOCUMENT_SELECTOR = [
  { scheme: "file", language: "latex" },
  { scheme: "file", language: "bibtex" },
  { scheme: "file", pattern: "**/*.tex" },
  { scheme: "file", pattern: "**/*.sty" },
  { scheme: "file", pattern: "**/*.cls" },
  { scheme: "file", pattern: "**/*.bib" },
];

const LSP_PATH_PATTERN = /\.(tex|sty|cls|bib)$/i;

export function matchesTexlabDocumentPath(path: string): boolean {
  return LSP_PATH_PATTERN.test(path);
}
