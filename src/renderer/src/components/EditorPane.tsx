import Editor, { loader, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as monacoLocal from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompileDiagnostic, OpenFile } from "../../../shared/domain";
import { normalizeDiagnosticPath } from "../../../shared/problems";

globalThis.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco: monacoLocal });

interface EditorPaneProps {
  file: OpenFile | null;
  diagnostics: CompileDiagnostic[];
  revealLine: number | null;
  onRevealHandled(): void;
  onDraftChange(path: string, content: string): void;
  onSave(content: string): void | Promise<void>;
}

interface LoadedEditorPaneProps {
  file: OpenFile;
  diagnostics: CompileDiagnostic[];
  revealLine: number | null;
  onRevealHandled(): void;
  onDraftChange(path: string, content: string): void;
  onSave(content: string): void | Promise<void>;
}

function languageForPath(path: string): string {
  if (path.endsWith(".tex")) return "latex";
  if (path.endsWith(".bib")) return "bibtex";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  return "plaintext";
}

function configureMonaco(monaco: Monaco): void {
  if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === "latex")) return;

  monaco.languages.register({ id: "latex", extensions: [".tex", ".sty", ".cls"] });
  monaco.languages.setMonarchTokensProvider("latex", {
    tokenizer: {
      root: [
        [/%.*$/, "comment"],
        [/\\[a-zA-Z@]+/, "keyword"],
        [/[{}[\]()]/, "delimiter"],
        [/\$[^$]*\$/, "string"],
        [/\b\d+(\.\d+)?\b/, "number"],
      ],
    },
  });

  monaco.languages.register({ id: "bibtex", extensions: [".bib"] });
  monaco.languages.setMonarchTokensProvider("bibtex", {
    tokenizer: {
      root: [
        [/@[a-zA-Z]+/, "keyword"],
        [/[{}=,]/, "delimiter"],
        [/"[^"]*"/, "string"],
        [/%.*$/, "comment"],
      ],
    },
  });
}

function EmptyEditorPane() {
  return (
    <section className="grid h-full min-h-0 min-w-0 place-items-center overflow-hidden bg-surface-raised">
      <div className="max-w-sm text-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
          Ready
        </span>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Open a LaTeX file to start editing.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          The editor stays isolated from compile and agent work so typing remains responsive under
          load.
        </p>
      </div>
    </section>
  );
}

function LoadedEditorPane({
  file,
  diagnostics,
  revealLine,
  onRevealHandled,
  onDraftChange,
  onSave,
}: LoadedEditorPaneProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const draftContentRef = useRef(file.content);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderCountRef = useRef(0);
  const [dirty, setDirty] = useState(false);
  renderCountRef.current += 1;

  const markers = useMemo(
    () =>
      diagnostics
        .filter((d) => {
          const path = normalizeDiagnosticPath(d.file);
          return d.line && (!path || path === file?.path);
        })
        .map(
          (d): editor.IMarkerData => ({
            severity: d.severity === "error" ? 8 : 4,
            message: d.message,
            startLineNumber: d.line ?? 1,
            startColumn: 1,
            endLineNumber: d.line ?? 1,
            endColumn: 120,
          }),
        ),
    [diagnostics, file?.path],
  );

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model) monacoRef.current?.editor.setModelMarkers(model, "latex-compiler", markers);
  }, [markers]);

  useEffect(() => {
    if (!revealLine || !editorRef.current) return;
    editorRef.current.revealLineInCenter(revealLine);
    onRevealHandled();
  }, [revealLine, file.path, file.loadedAt, onRevealHandled]);

  useEffect(
    () => () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    },
    [],
  );

  function scheduleAutosave(content: string): void {
    if (!file) return;
    onDraftChange(file.path, content);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void onSave(draftContentRef.current);
      setDirty(false);
    }, 650);
  }

  function saveNow(): void {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    void onSave(draftContentRef.current);
    setDirty(false);
  }

  return (
    <section className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-surface-raised">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-400" : "bg-accent"}`}
            />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              {dirty ? "Unsaved" : "Saved"}
            </span>
          </div>
          <h2 className="mt-0.5 truncate text-sm font-medium">{file.path}</h2>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border bg-transparent px-3 py-1 text-xs font-medium text-text-muted transition-colors duration-100 hover:border-accent/40 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
          onClick={saveNow}
          disabled={!dirty}
        >
          Save
        </button>
      </header>
      <Editor
        key={`${file.path}:${file.loadedAt}`}
        height="100%"
        theme="vs-dark"
        language={languageForPath(file.path)}
        value={file.content}
        beforeMount={configureMonaco}
        onChange={(v) => {
          draftContentRef.current = v ?? "";
          setDirty(true);
          scheduleAutosave(draftContentRef.current);
        }}
        onMount={(ed, monaco) => {
          editorRef.current = ed;
          monacoRef.current = monaco;
          const model = ed.getModel();
          if (model) monaco.editor.setModelMarkers(model, "latex-compiler", markers);
          ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveNow);
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
          lineHeight: 22,
          padding: { top: 14, bottom: 14 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          automaticLayout: true,
          wordWrap: "on",
        }}
      />
    </section>
  );
}

export function EditorPane({
  file,
  diagnostics,
  revealLine,
  onRevealHandled,
  onDraftChange,
  onSave,
}: EditorPaneProps) {
  if (!file) return <EmptyEditorPane />;
  return (
    <LoadedEditorPane
      key={`${file.path}:${file.loadedAt}`}
      file={file}
      diagnostics={diagnostics}
      revealLine={revealLine}
      onRevealHandled={onRevealHandled}
      onDraftChange={onDraftChange}
      onSave={onSave}
    />
  );
}
