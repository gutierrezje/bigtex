import { basename, extname, join } from "node:path";

/** Hidden project folder for latexmk aux + PDF output (keeps the tree source-focused). */
export const LATEX_BUILD_DIR = ".tex-build";

export const IGNORED_PROJECT_DIRECTORY_NAMES = [
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "out",
  ".latex-cache",
  LATEX_BUILD_DIR,
] as const;

/** LaTeX / latexmk artifacts — hidden from the project tree and file watcher. */
export const IGNORED_LATEX_FILE_EXTENSIONS = [
  ".aux",
  ".bbl",
  ".bcf",
  ".blg",
  ".fdb_latexmk",
  ".fls",
  ".log",
  ".out",
  ".toc",
  ".lof",
  ".lot",
  ".nav",
  ".snm",
  ".vrb",
  ".xdv",
  ".dvi",
  ".synctex.gz",
  ".synctex(busy)",
  ".run.xml",
  ".auxlock",
  ".loe",
  ".lol",
  ".acn",
  ".acr",
  ".alg",
  ".glg",
  ".gls",
  ".glo",
  ".ist",
  ".idx",
  ".ilg",
  ".ind",
  ".loa",
  ".listing",
] as const;

const ignoredDirectorySet = new Set<string>(IGNORED_PROJECT_DIRECTORY_NAMES);
const ignoredExtensionSet = new Set<string>(IGNORED_LATEX_FILE_EXTENSIONS);

export function isIgnoredProjectDirectory(name: string): boolean {
  return ignoredDirectorySet.has(name);
}

export function isIgnoredLatexArtifactFile(name: string): boolean {
  return ignoredExtensionSet.has(extname(name).toLowerCase());
}

export function isIgnoredProjectRelativePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => ignoredDirectorySet.has(segment))) return true;
  return ignoredExtensionSet.has(extname(normalized).toLowerCase());
}

export function shouldHideProjectTreeEntry(name: string, isDirectory: boolean): boolean {
  if (isDirectory) return isIgnoredProjectDirectory(name);
  return isIgnoredLatexArtifactFile(name);
}

export function latexBuildDirectory(rootPath: string): string {
  return join(rootPath, LATEX_BUILD_DIR);
}

export function latexOutputPdfPath(rootPath: string, mainFile: string): string {
  const base = basename(mainFile, extname(mainFile));
  return join(latexBuildDirectory(rootPath), `${base}.pdf`);
}
