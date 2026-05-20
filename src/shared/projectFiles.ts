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
