import type { OpenFile, PdfPayload } from "./domain";

export interface EditorTabsState {
  files: OpenFile[];
  activePath: string | null;
}

export interface PdfTabsState {
  pdfs: PdfPayload[];
  activePath: string | null;
}

export function initialEditorTabs(): EditorTabsState {
  return { files: [], activePath: null };
}

export function initialPdfTabs(): PdfTabsState {
  return { pdfs: [], activePath: null };
}

export function getActiveEditor(state: EditorTabsState): OpenFile | null {
  if (!state.activePath) return null;
  return state.files.find((file) => file.path === state.activePath) ?? null;
}

export function getActivePdf(state: PdfTabsState): PdfPayload | null {
  if (!state.activePath) return null;
  return state.pdfs.find((pdf) => pdf.path === state.activePath) ?? null;
}

export function focusOrOpenEditor(state: EditorTabsState, file: OpenFile): EditorTabsState {
  const existing = state.files.find((entry) => entry.path === file.path);
  if (existing) {
    return { ...state, activePath: file.path };
  }
  return {
    files: [...state.files, file],
    activePath: file.path,
  };
}

export function focusOrOpenPdf(state: PdfTabsState, pdf: PdfPayload): PdfTabsState {
  const existing = state.pdfs.find((entry) => entry.path === pdf.path);
  if (existing) {
    return {
      pdfs: state.pdfs.map((entry) => (entry.path === pdf.path ? pdf : entry)),
      activePath: pdf.path,
    };
  }
  return {
    pdfs: [...state.pdfs, pdf],
    activePath: pdf.path,
  };
}

export function closeEditorTab(state: EditorTabsState, path: string): EditorTabsState {
  const index = state.files.findIndex((file) => file.path === path);
  if (index < 0) return state;

  const files = state.files.filter((file) => file.path !== path);
  let activePath = state.activePath;
  if (activePath === path) {
    const next = files[index] ?? files[index - 1] ?? null;
    activePath = next?.path ?? null;
  }
  return { files, activePath };
}

export function closePdfTab(state: PdfTabsState, path: string): PdfTabsState {
  const index = state.pdfs.findIndex((pdf) => pdf.path === path);
  if (index < 0) return state;

  const pdfs = state.pdfs.filter((pdf) => pdf.path !== path);
  let activePath = state.activePath;
  if (activePath === path) {
    const next = pdfs[index] ?? pdfs[index - 1] ?? null;
    activePath = next?.path ?? null;
  }
  return { pdfs, activePath };
}

export function renameEditorPath(
  state: EditorTabsState,
  oldPath: string,
  newPath: string,
  file?: OpenFile,
): EditorTabsState {
  const files = state.files.map((entry) => {
    if (entry.path !== oldPath) return entry;
    return file ?? { ...entry, path: newPath, absolutePath: entry.absolutePath };
  });
  const activePath = state.activePath === oldPath ? newPath : state.activePath;
  return { files, activePath };
}

export function renamePdfPath(state: PdfTabsState, oldPath: string, newPath: string): PdfTabsState {
  const pdfs = state.pdfs.map((pdf) => (pdf.path === oldPath ? { ...pdf, path: newPath } : pdf));
  const activePath = state.activePath === oldPath ? newPath : state.activePath;
  return { pdfs, activePath };
}

export function removeEditorPath(state: EditorTabsState, path: string): EditorTabsState {
  return closeEditorTab(state, path);
}

export function removePdfPath(state: PdfTabsState, path: string): PdfTabsState {
  return closePdfTab(state, path);
}

export function updateEditorContent(
  state: EditorTabsState,
  path: string,
  content: string,
  dirty: boolean,
): EditorTabsState {
  return {
    ...state,
    files: state.files.map((file) => (file.path === path ? { ...file, content, dirty } : file)),
  };
}

export function listDirtyEditorPaths(state: EditorTabsState): string[] {
  return state.files.filter((file) => file.dirty).map((file) => file.path);
}

export function activateEditorTab(state: EditorTabsState, path: string): EditorTabsState {
  if (!state.files.some((file) => file.path === path)) return state;
  return { ...state, activePath: path };
}

export function activatePdfTab(state: PdfTabsState, path: string): PdfTabsState {
  if (!state.pdfs.some((pdf) => pdf.path === path)) return state;
  return { ...state, activePath: path };
}

export function replaceEditorFile(state: EditorTabsState, file: OpenFile): EditorTabsState {
  return {
    ...state,
    files: state.files.map((entry) => (entry.path === file.path ? file : entry)),
  };
}

export interface TabLabelParts {
  /** File name shown as the tab's primary label. */
  name: string;
  /**
   * Disambiguating folder fragment shown dimmed after the name, VS Code style.
   * Present only when another open tab shares the same file name.
   */
  hint?: string;
}

function splitPath(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean);
}

/**
 * Computes the display label for each open tab. When several tabs share the same
 * file name, each is given the shortest trailing folder fragment that makes it
 * unique within that group (mirroring VS Code's tab disambiguation).
 */
export function computeTabLabels(paths: string[]): Map<string, TabLabelParts> {
  const result = new Map<string, TabLabelParts>();
  const groups = new Map<string, string[]>();

  for (const path of paths) {
    const segments = splitPath(path);
    const name = segments[segments.length - 1] || path;
    const existing = groups.get(name);
    if (existing) {
      existing.push(path);
    } else {
      groups.set(name, [path]);
    }
  }

  for (const [name, group] of groups) {
    if (group.length < 2) {
      for (const path of group) result.set(path, { name });
      continue;
    }

    for (const path of group) {
      const dirs = splitPath(path).slice(0, -1);
      let hint: string | undefined;
      for (let depth = 1; depth <= dirs.length; depth += 1) {
        const suffix = dirs.slice(dirs.length - depth);
        const candidate = suffix.join("/");
        const unique = group.every((other) => {
          if (other === path) return true;
          const otherDirs = splitPath(other).slice(0, -1);
          return otherDirs.slice(otherDirs.length - depth).join("/") !== candidate;
        });
        if (unique) {
          hint = depth < dirs.length ? `…/${candidate}` : candidate;
          break;
        }
      }
      result.set(path, hint ? { name, hint } : { name });
    }
  }

  return result;
}
