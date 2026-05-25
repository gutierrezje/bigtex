import Editor, { loader, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import * as monacoLocal from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CompileDiagnostic, OpenFile } from "../../../shared/domain";
import { normalizeDiagnosticPath } from "../../../shared/problems";
import { BIGTEX_MONACO_THEME, registerBigTexMonacoTheme } from "../lib/monacoTheme";
import { CHROME_META_CLASS, CHROME_SECTION_CLASS } from "../lib/treeTypography";
import { getOrCreateLspEditorModel, isLspEditorPath } from "../lsp/editor-documents";
import { pathToFileUri } from "../lsp/file-uri";

globalThis.MonacoEnvironment = {
  getWorker() {
    return new editorWorker();
  },
};

loader.config({ monaco: monacoLocal });
registerBigTexMonacoTheme(monacoLocal);

interface EditorPaneProps {
  file: OpenFile | null;
  /** Project-relative path while the initial main file is being read after open. */
  openingPath: string | null;
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
  if (path.endsWith(".tex") || path.endsWith(".sty") || path.endsWith(".cls")) return "latex";
  if (path.endsWith(".bib")) return "bibtex";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
  return "plaintext";
}

function configureMonaco(monaco: Monaco): void {
  registerBigTexMonacoTheme(monaco);
  if (monaco.languages.getLanguages().some((l: { id: string }) => l.id === "latex")) return;

  monaco.languages.register({ id: "latex", extensions: [".tex", ".sty", ".cls"] });
  monaco.languages.setLanguageConfiguration("latex", {
    comments: { lineComment: "%" },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "$", close: "$" },
    ],
  });
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
        [/@[cC]omment\s*\{/, { token: "comment", next: "@commentBody" }],
        [/@[a-zA-Z]+/, "keyword"],
        [/[{}=,]/, "delimiter"],
        [/"[^"]*"/, "string"],
      ],
      commentBody: [
        [/[^{}]+/, "comment"],
        [/{/, "comment", "@push"],
        [/}/, { token: "comment", next: "@pop" }],
      ],
    },
  });
}

function registerLspEditorCommands(editor: editor.IStandaloneCodeEditor, monaco: Monaco): void {
  const runBuiltin = (actionId: string) => {
    const action = editor.getAction(actionId);
    if (action) void action.run();
  };

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12, () => {
    runBuiltin("editor.action.revealDefinition");
  });
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.F12, () => {
    runBuiltin("editor.action.goToReferences");
  });
}

function editorTabLabel(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function EmptyEditorPane() {
  return (
    <section className="grid h-full min-h-0 min-w-0 place-items-center overflow-hidden bg-surface">
      <div className="max-w-sm text-center">
        <span className={`${CHROME_SECTION_CLASS} text-accent`}>Ready</span>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          Open a LaTeX file to start editing.
        </h2>
        <p className={`mt-2 ${CHROME_META_CLASS} text-text-muted`}>
          The editor stays isolated from compile and agent work so typing remains responsive under
          load.
        </p>
      </div>
    </section>
  );
}

function LoadingEditorPane({ path }: { path: string }) {
  const label = editorTabLabel(path);
  return (
    <section className="grid h-full min-h-0 min-w-0 place-items-center overflow-hidden bg-surface">
      <div className="max-w-sm text-center">
        <span className={`${CHROME_SECTION_CLASS} text-accent`}>Opening</span>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{label}</h2>
        <p className={`mt-2 ${CHROME_META_CLASS} text-text-muted`}>Loading file from disk…</p>
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
  const [, setDirty] = useState(file.dirty);
  renderCountRef.current += 1;

  useEffect(() => {
    draftContentRef.current = file.content;
    setDirty(file.dirty);
  }, [file.content, file.dirty, file.loadedAt, file.path]);

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
    if (!isLspEditorPath(file.path)) return;
    const uri = monacoLocal.Uri.parse(pathToFileUri(file.absolutePath));
    const model = monacoLocal.editor.getModel(uri);
    if (!model || model.getValue() === file.content) return;
    model.setValue(file.content);
  }, [file.absolutePath, file.content, file.loadedAt, file.path]);

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

  const usesLspModel = isLspEditorPath(file.path);

  return (
    <section className="grid h-full min-h-0 min-w-0 overflow-hidden bg-surface">
      <Editor
        key={file.path}
        height="100%"
        theme={BIGTEX_MONACO_THEME}
        language={languageForPath(file.path)}
        defaultValue={file.content}
        value={usesLspModel ? undefined : file.content}
        beforeMount={configureMonaco}
        onChange={(v) => {
          draftContentRef.current = v ?? "";
          setDirty(true);
          scheduleAutosave(draftContentRef.current);
        }}
        onMount={(ed, monaco) => {
          registerBigTexMonacoTheme(monaco);
          monaco.editor.setTheme(BIGTEX_MONACO_THEME);
          editorRef.current = ed;
          monacoRef.current = monaco;
          const lspModel = getOrCreateLspEditorModel(file);
          if (lspModel) {
            ed.setModel(lspModel);
          }
          const model = ed.getModel();
          if (model) monaco.editor.setModelMarkers(model, "latex-compiler", markers);
          ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveNow);
          if (usesLspModel) {
            registerLspEditorCommands(ed, monaco);
          }
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
  openingPath,
  diagnostics,
  revealLine,
  onRevealHandled,
  onDraftChange,
  onSave,
}: EditorPaneProps) {
  if (file) {
    return (
      <LoadedEditorPane
        key={file.path}
        file={file}
        diagnostics={diagnostics}
        revealLine={revealLine}
        onRevealHandled={onRevealHandled}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }
  if (openingPath) return <LoadingEditorPane path={openingPath} />;
  return <EmptyEditorPane />;
}
