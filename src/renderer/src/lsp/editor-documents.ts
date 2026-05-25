import * as monaco from "monaco-editor";
import type { OpenFile } from "../../../shared/domain";
import { isLspEditorPath, languageIdForLspPath } from "./editor-document-paths";
import { pathToFileUri } from "./file-uri";

export { isLspEditorPath } from "./editor-document-paths";

function modelUriForFile(file: OpenFile): monaco.Uri {
  return monaco.Uri.parse(pathToFileUri(file.absolutePath));
}

const trackedModelUris = new Set<string>();

/** Create or reuse a file:// model for Texlab sync (all open editor tabs). */
export function getOrCreateLspEditorModel(file: OpenFile): monaco.editor.ITextModel | null {
  const language = languageIdForLspPath(file.path);
  if (!language) return null;

  const uri = modelUriForFile(file);
  let model = monaco.editor.getModel(uri);
  if (!model) {
    model = monaco.editor.createModel(file.content, language, uri);
    trackedModelUris.add(uri.toString());
    return model;
  }

  trackedModelUris.add(uri.toString());
  if (model.getLanguageId() !== language) {
    monaco.editor.setModelLanguage(model, language);
  }
  if (model.getValue() !== file.content) {
    model.setValue(file.content);
  }
  return model;
}

/** Align open-tab models with the store; open, update, and close LSP documents. */
export function syncLspEditorTabModels(files: OpenFile[]): void {
  const keep = new Set<string>();

  for (const file of files) {
    if (!isLspEditorPath(file.path)) continue;
    const uri = modelUriForFile(file).toString();
    keep.add(uri);
    getOrCreateLspEditorModel(file);
  }

  for (const uri of [...trackedModelUris]) {
    if (keep.has(uri)) continue;
    monaco.editor.getModel(monaco.Uri.parse(uri))?.dispose();
    trackedModelUris.delete(uri);
  }
}

export function disposeAllLspEditorDocuments(): void {
  for (const uri of [...trackedModelUris]) {
    monaco.editor.getModel(monaco.Uri.parse(uri))?.dispose();
  }
  trackedModelUris.clear();
}
