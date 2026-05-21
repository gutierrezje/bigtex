import type { CreatableFileExtension } from "./projectFiles";

export interface NewFileTemplate {
  id: string;
  label: string;
  description: string;
  extension: CreatableFileExtension;
  defaultStem: string;
}

/** Workspace "Add New File" kinds (VS-style new-item list). */
export const NEW_FILE_TEMPLATES: NewFileTemplate[] = [
  {
    id: "tex",
    label: "LaTeX Document",
    description: "Main or included TeX source",
    extension: ".tex",
    defaultStem: "untitled",
  },
  {
    id: "bib",
    label: "BibTeX Database",
    description: "Bibliography entries",
    extension: ".bib",
    defaultStem: "references",
  },
  {
    id: "sty",
    label: "LaTeX Style",
    description: "Custom style package",
    extension: ".sty",
    defaultStem: "custom",
  },
  {
    id: "cls",
    label: "LaTeX Class",
    description: "Document class definition",
    extension: ".cls",
    defaultStem: "custom",
  },
];

export const DEFAULT_NEW_FILE_TEMPLATE_ID = NEW_FILE_TEMPLATES[0].id;

export function templateById(id: string): NewFileTemplate | undefined {
  return NEW_FILE_TEMPLATES.find((template) => template.id === id);
}

/** Build a creatable filename from a stem and template extension. */
export function resolveNewFileName(stem: string, extension: CreatableFileExtension): string | null {
  const trimmed = stem.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\")) return null;

  const lower = trimmed.toLowerCase();
  if (lower.endsWith(extension)) return trimmed;

  return `${trimmed}${extension}`;
}
