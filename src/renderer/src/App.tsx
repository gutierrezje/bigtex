import { useCallback, useEffect, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { ProjectFile, ProjectSnapshot } from "../../shared/domain";
import { AgentPanel } from "./components/AgentPanel";
import { CommandBar } from "./components/CommandBar";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { EditorPane } from "./components/EditorPane";
import { PdfPreview } from "./components/PdfPreview";
import { ProjectSidebar } from "./components/ProjectSidebar";
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

  // Layout collapsed states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDiagnosticsCollapsed, setIsDiagnosticsCollapsed] = useState(false);
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(false);
  const [isAgentCollapsed, setIsAgentCollapsed] = useState(false);

  // Imperative refs for panel control
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const diagnosticsRef = useRef<PanelImperativeHandle>(null);
  const pdfRef = useRef<PanelImperativeHandle>(null);
  const agentRef = useRef<PanelImperativeHandle>(null);

  const activeDraftRef = useRef<{ path: string; content: string } | null>(null);
  const openFileRef = useRef(openFile);
  const projectRef = useRef(project);
  openFileRef.current = openFile;
  projectRef.current = project;

  // Toggle handlers calling imperative API
  const handleToggleSidebar = () => {
    const panel = sidebarRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  const handleToggleDiagnostics = () => {
    const panel = diagnosticsRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  const handleTogglePdf = () => {
    const panel = pdfRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

  const handleToggleAgent = () => {
    const panel = agentRef.current;
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand();
      } else {
        panel.collapse();
      }
    }
  };

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
    void useAppStore.getState().loadAgentConfig(snapshot.rootPath);

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

  async function runAgent(
    prompt: string,
    modelId: string,
    reasoningLevel: string | null,
  ): Promise<void> {
    if (!project) return;
    await window.bigTex.agent.run({
      rootPath: project.rootPath,
      prompt,
      selectedFiles: openFile ? [openFile.path] : [],
      diagnostics: compileResult?.diagnostics ?? [],
      modelId,
      reasoningLevel,
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
    <main className="flex h-screen w-screen flex-col min-h-0 overflow-hidden bg-background">
      <CommandBar
        compiler={compiler}
        metrics={metrics}
        onCompilerChange={setCompiler}
        onRefreshMetrics={() => void refreshMetrics()}
        showSidebar={!isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        showDiagnostics={!isDiagnosticsCollapsed}
        onToggleDiagnostics={handleToggleDiagnostics}
        showPdf={!isPdfCollapsed}
        onTogglePdf={handleTogglePdf}
        showAgent={!isAgentCollapsed}
        onToggleAgent={handleToggleAgent}
      />
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <Group
          className="h-full w-full min-h-0 min-w-0"
          id="bigtex-outer-layout"
          orientation="horizontal"
        >
          <Panel
            panelRef={sidebarRef}
            collapsible={true}
            defaultSize="16%"
            minSize="12%"
            maxSize="25%"
            onResize={(size, _, prev) => {
              if (prev !== undefined) {
                setIsSidebarCollapsed(size.asPercentage < 1);
              }
            }}
            className="h-full min-h-0 min-w-0"
          >
            <ProjectSidebar
              project={project}
              activePath={openFile?.path ?? null}
              onOpenProject={() => void openProjectFromDialog()}
              onOpenSample={() => void loadSample()}
              onOpenFile={(file) => void openProjectFile(file)}
            />
          </Panel>

          <Separator
            className={`resize-handle-horizontal ${
              isSidebarCollapsed ? "hidden pointer-events-none" : ""
            }`}
          />

          <Panel defaultSize="84%" className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden p-3">
              <Group
                className="h-full min-h-0 min-w-0"
                id="bigtex-main-panels"
                orientation="horizontal"
              >
                <Panel defaultSize="38%" minSize="25%" className="min-h-0 min-w-0">
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

                    <Separator
                      className={`resize-handle-vertical ${
                        isDiagnosticsCollapsed ? "hidden pointer-events-none" : ""
                      }`}
                    />

                    <Panel
                      panelRef={diagnosticsRef}
                      collapsible={true}
                      defaultSize="22%"
                      minSize="14%"
                      maxSize="45%"
                      onResize={(size, _, prev) => {
                        if (prev !== undefined) {
                          setIsDiagnosticsCollapsed(size.asPercentage < 1);
                        }
                      }}
                      className="min-h-0 min-w-0"
                    >
                      <DiagnosticsPanel
                        result={compileResult}
                        compiling={compiling}
                        onCompile={() => void compile()}
                      />
                    </Panel>
                  </Group>
                </Panel>

                <Separator
                  className={`resize-handle-horizontal ${
                    isPdfCollapsed ? "hidden pointer-events-none" : ""
                  }`}
                />

                <Panel
                  panelRef={pdfRef}
                  collapsible={true}
                  defaultSize="35%"
                  minSize="20%"
                  onResize={(size, _, prev) => {
                    if (prev !== undefined) {
                      setIsPdfCollapsed(size.asPercentage < 1);
                    }
                  }}
                  className="min-h-0 min-w-0"
                >
                  <PdfPreview pdf={pdf} />
                </Panel>

                <Separator
                  className={`resize-handle-horizontal ${
                    isAgentCollapsed ? "hidden pointer-events-none" : ""
                  }`}
                />

                <Panel
                  panelRef={agentRef}
                  collapsible={true}
                  defaultSize="27%"
                  minSize="20%"
                  onResize={(size, _, prev) => {
                    if (prev !== undefined) {
                      setIsAgentCollapsed(size.asPercentage < 1);
                    }
                  }}
                  className="min-h-0 min-w-0"
                >
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
          </Panel>
        </Group>
      </div>

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
