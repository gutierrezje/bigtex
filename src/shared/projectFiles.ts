/** Extensions allowed when creating new project files from the UI. */
export const CREATABLE_FILE_EXTENSIONS = [".tex", ".bib", ".sty", ".cls"] as const;

export type CreatableFileExtension = (typeof CREATABLE_FILE_EXTENSIONS)[number];

export const DEFAULT_NEW_FILE_NAME = "untitled.tex";

export function isCreatableFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return CREATABLE_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function parentDirectoryPath(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash === -1 ? "" : filePath.slice(0, slash);
}

/** Folder paths that must be expanded to reveal `filePath` in the project tree. */
export function ancestorFolderPaths(filePath: string): string[] {
  const folders: string[] = [];
  let dir = parentDirectoryPath(filePath);
  while (dir) {
    folders.push(dir);
    dir = parentDirectoryPath(dir);
  }
  return folders;
}

export function isPdfPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".pdf");
}

/** Project-relative path (forward slashes) from an absolute path under the project root. */
export function toProjectRelativePath(rootPath: string, absolutePath: string): string {
  const root = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  const abs = absolutePath.replace(/\\/g, "/");
  if (!abs.startsWith(`${root}/`)) return absolutePath;
  return abs.slice(root.length + 1);
}
