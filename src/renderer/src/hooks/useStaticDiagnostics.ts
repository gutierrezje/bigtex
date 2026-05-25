import * as monaco from "monaco-editor";
import { useEffect, useState } from "react";
import type { CompileDiagnostic } from "../../../shared/domain";
import { collectStaticDiagnostics } from "../lsp/static-diagnostics";

export function useStaticDiagnostics(rootPath: string | null): CompileDiagnostic[] {
  const [diagnostics, setDiagnostics] = useState<CompileDiagnostic[]>([]);

  useEffect(() => {
    if (!rootPath) {
      setDiagnostics([]);
      return;
    }

    const refresh = () => {
      setDiagnostics(collectStaticDiagnostics(rootPath));
    };

    refresh();
    const subscription = monaco.editor.onDidChangeMarkers(refresh);
    return () => subscription.dispose();
  }, [rootPath]);

  return diagnostics;
}
