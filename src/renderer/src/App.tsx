import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { ProjectFile, ProjectSnapshot } from "../../shared/domain";
import { AgentPanel } from "./components/AgentPanel";
import { CommandBar } from "./components/CommandBar";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { EditorPane } from "./components/EditorPane";
import { PdfPreview } from "./components/PdfPreview";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { TitleBar } from "./components/TitleBar";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { useAppStore } from "./store";

function selectable(file: ProjectFile): boolean {
  return file.kind !== "folder";
}

export function App() {
  const {
    project,
    openFile,
    compiler,
    compileResult,
    pdf,
    agentChat,
    metrics,
    setProject,
    setOpenFile,
    setCompileResult,
    setPdf,
    setCompiler,
    clearAgent,
    setMetrics,
  } = useAppStore();
  const [compiling, setCompiling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const activeDraftRef = useRef<{ path: string; content: string } | null>(null);
  const openFileRef = useRef(openFile);
  const projectRef = useRef(project);
  openFileRef.current = openFile;
  projectRef.current = project;

  const refreshProjectFiles = useCallback(
    async (paths?: string[], toastMessage?: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;

      const refreshed = await window.bigTex.project.load(currentProject.rootPath);
      setProject(refreshed);

      const activePath = openFileRef.current?.path;
      const reloadPath =
        activePath && paths?.some((path) => path === activePath || path.endsWith(`/${activePath}`))
          ? activePath
          : paths?.[0];
      if (reloadPath) {
        const file = await window.bigTex.files.read({
          rootPath: currentProject.rootPath,
          path: reloadPath,
        });
        setOpenFile(file);
        activeDraftRef.current = { path: file.path, content: file.content };
      }

      if (toastMessage) setToast(toastMessage);
    },
    [setProject, setOpenFile],
  );

  useAgentEvents({
    onFilesChanged: (event) => {
      void refreshProjectFiles(
        event.paths,
        event.paths.length === 1
          ? `Agent updated ${event.paths[0]}.`
          : `Agent updated ${event.paths.length} files.`,
      );
    },
    onFinished: () => {
      void refreshProjectFiles();
    },
  });

  useEffect(() => {
    void refreshMetrics();
  }, []);

  async function refreshMetrics(): Promise<void> {
    setMetrics(await window.bigTex.app.metrics());
  }

  async function loadProject(snapshot: ProjectSnapshot | null): Promise<void> {
    if (!snapshot) return;
    setProject(snapshot);
    setCompileResult(null);
    setPdf(null);
    clearAgent();

    if (snapshot.mainFile) {
      const file = await window.bigTex.files.read({
        rootPath: snapshot.rootPath,
        path: snapshot.mainFile,
      });
      setOpenFile(file);
      activeDraftRef.current = { path: file.path, content: file.content };
    }
  }

  async function openProjectFromDialog(): Promise<void> {
    await loadProject(await window.bigTex.project.openDialog());
  }

  async function loadSample(): Promise<void> {
    await loadProject(await window.bigTex.project.openSample());
  }

  async function openProjectFile(file: ProjectFile): Promise<void> {
    if (!project || !selectable(file)) return;
    const openedFile = await window.bigTex.files.read({
      rootPath: project.rootPath,
      path: file.path,
    });
    setOpenFile(openedFile);
    activeDraftRef.current = { path: openedFile.path, content: openedFile.content };
  }

  async function saveOpenFile(
    content = activeDraftRef.current?.content ?? openFile?.content ?? "",
  ): Promise<void> {
    if (!project || !openFile) return;
    setOpenFile(
      await window.bigTex.files.write({
        rootPath: project.rootPath,
        path: openFile.path,
        content,
      }),
    );
  }

  async function compile(): Promise<void> {
    if (!project) return;
    const mainFile = project.mainFile ?? openFile?.path;
    if (!mainFile) return;

    setCompiling(true);
    try {
      if (openFile && activeDraftRef.current?.path === openFile.path) {
        await saveOpenFile(activeDraftRef.current.content);
      }

      const result = await window.bigTex.latex.compile({
        rootPath: project.rootPath,
        mainFile,
        compiler,
      });
      setCompileResult(result);
      if (result.pdfPath) {
        setPdf(await window.bigTex.latex.readPdf(result.pdfPath));
      }
      setToast(result.success ? "Compiled PDF." : "Compiler reported diagnostics.");
    } finally {
      setCompiling(false);
      await refreshMetrics();
    }
  }

  async function runAgent(prompt: string): Promise<void> {
    if (!project) return;
    await window.bigTex.agent.run({
      rootPath: project.rootPath,
      prompt,
      selectedFiles: openFile ? [openFile.path] : [],
      diagnostics: compileResult?.diagnostics ?? [],
    });
  }

  async function applyPatch(patch: string): Promise<void> {
    if (!project) return;
    const result = await window.bigTex.patch.apply({ rootPath: project.rootPath, patch });
    if (result.applied) {
      await refreshProjectFiles(
        result.changedFiles,
        result.message || `Applied ${result.changedFiles.length} file change(s).`,
      );
      return;
    }
    setToast(result.message ? `Patch failed: ${result.message}` : "Patch failed.");
  }

  return (
    <main className="grid h-screen min-h-0 grid-cols-[clamp(190px,18vw,256px)_minmax(0,1fr)] overflow-hidden">
      <ProjectSidebar
        project={project}
        activePath={openFile?.path ?? null}
        onOpenProject={() => void openProjectFromDialog()}
        onOpenSample={() => void loadSample()}
        onOpenFile={(file) => void openProjectFile(file)}
      />

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <TitleBar />
        <CommandBar
          compiler={compiler}
          metrics={metrics}
          onCompilerChange={setCompiler}
          onRefreshMetrics={() => void refreshMetrics()}
        />

        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
          <Group
            className="h-full min-h-0 min-w-0"
            id="bigtex-main-panels"
            orientation="horizontal"
          >
            <Panel defaultSize="42%" minSize="28%" className="min-h-0 min-w-0">
              <Group
                className="h-full min-h-0 min-w-0"
                id="bigtex-editor-panels"
                orientation="vertical"
              >
                <Panel defaultSize="78%" minSize="40%" className="min-h-0 min-w-0">
                  <EditorPane
                    file={openFile}
                    diagnostics={compileResult?.diagnostics ?? []}
                    onDraftChange={(path, content) => {
                      activeDraftRef.current = { path, content };
                    }}
                    onSave={(content) => void saveOpenFile(content)}
                  />
                </Panel>
                <Separator className="resize-handle-vertical" />
                <Panel defaultSize="22%" minSize="14%" maxSize="45%" className="min-h-0 min-w-0">
                  <DiagnosticsPanel
                    result={compileResult}
                    compiling={compiling}
                    onCompile={() => void compile()}
                  />
                </Panel>
              </Group>
            </Panel>

            <Separator className="resize-handle-horizontal" />

            <Panel defaultSize="33%" minSize="22%" className="min-h-0 min-w-0">
              <PdfPreview pdf={pdf} />
            </Panel>

            <Separator className="resize-handle-horizontal" />

            <Panel defaultSize="25%" minSize="20%" className="min-h-0 min-w-0">
              <AgentPanel
                rootPath={project?.rootPath ?? null}
                activeFile={openFile?.path ?? null}
                diagnostics={compileResult?.diagnostics ?? []}
                chat={agentChat}
                onRun={runAgent}
                onCancel={(runId) => window.bigTex.agent.cancel({ runId })}
                onApplyPatch={applyPatch}
              />
            </Panel>
          </Group>
        </div>
      </section>

      {toast ? (
        <button
          type="button"
          className="fixed right-5 bottom-5 z-50 max-w-sm rounded-lg border border-border bg-surface-raised/95 px-4 py-2.5 font-mono text-sm text-text-secondary shadow-xl backdrop-blur-sm transition-colors duration-150 hover:border-accent/40 hover:text-text-primary"
          onClick={() => setToast(null)}
        >
          {toast}
        </button>
      ) : null}
    </main>
  );
}
