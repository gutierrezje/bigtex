import * as monaco from "monaco-editor";
import type { CompileDiagnostic } from "../../../shared/domain";
import { fileUriToProjectRelativePath } from "./file-uri";

/** Marker owner used by monaco-languageclient (`diagnosticCollectionName`). */
export const LSP_DIAGNOSTIC_OWNER = "latex-lsp";

function markerSeverity(severity: monaco.MarkerSeverity): CompileDiagnostic["severity"] {
  return severity === monaco.MarkerSeverity.Error ? "error" : "warning";
}

/** Read Texlab squiggles from Monaco into Problems-panel rows. */
export function collectStaticDiagnostics(rootPath: string): CompileDiagnostic[] {
  const diagnostics: CompileDiagnostic[] = [];

  for (const model of monaco.editor.getModels()) {
    if (model.uri.scheme !== "file") continue;

    const file = fileUriToProjectRelativePath(model.uri.toString(), rootPath);
    if (!file) continue;

    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    for (const marker of markers) {
      if (marker.owner !== LSP_DIAGNOSTIC_OWNER) continue;
      diagnostics.push({
        file,
        line: marker.startLineNumber,
        severity: markerSeverity(marker.severity),
        message: marker.message,
        source: "static",
      });
    }
  }

  diagnostics.sort((a, b) => {
    const path = (a.file ?? "").localeCompare(b.file ?? "");
    if (path !== 0) return path;
    return (a.line ?? 0) - (b.line ?? 0);
  });

  return diagnostics;
}
