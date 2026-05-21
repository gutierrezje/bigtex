import { useCallback, useEffect, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { CompileDiagnostic, ProjectFile, ProjectSnapshot } from "../../shared/domain";
import {
  countDiagnosticsBySeverity,
  findProjectFileByPath,
  formatAgentHandoffLine,
  formatCompileSummary,
  mergeAgentSelectedFiles,
  normalizeDiagnosticPath,
} from "../../shared/problems";
import { AgentPanel } from "./components/AgentPanel";
import { CommandBar } from "./components/CommandBar";
import { EditorBottomPanel, type EditorBottomTab } from "./components/EditorBottomPanel";
import { EditorPane } from "./components/EditorPane";
import { PdfPreview } from "./components/PdfPreview";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useAgentEvents } from "./hooks/useAgentEvents";

import { formatWindowChromeLabel } from "./lib/windowChrome";
import { useAppStore } from "./store";

function selectable(file: ProjectFile): boolean {
  return file.kind !== "folder";
}

export function App() {
  const {
    project,
    openFile,
    compileResult,
    pdf,
    agentChat,
    setProject,
    setOpenFile,
    setCompileResult,
    setPdf,
    clearAgent,
    clearOutputLog,
    refreshMetrics,
  } = useAppStore();
  const [compiling, setCompiling] = useState(false);
  const [editorRevealLine, setEditorRevealLine] = useState<number | null>(null);
  const [editorBottomTab, setEditorBottomTab] = useState<EditorBottomTab>("problems");
  const appendAgentComposerHandoff = useAppStore((state) => state.appendAgentComposerHandoff);
  const agentHandoffFiles = useAppStore((state) => state.agentHandoffFiles);
  const appendOutput = useAppStore((state) => state.appendOutput);

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

  useEffect(() => {
    document.title = formatWindowChromeLabel(project?.name ?? null, openFile?.path ?? null);
  }, [project?.name, openFile?.path]);

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

      if (toastMessage) appendOutput(toastMessage, "success");
    },
    [setProject, setOpenFile, appendOutput],
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

  async function loadProject(snapshot: ProjectSnapshot | null): Promise<void> {
    if (!snapshot) return;
    setProject(snapshot);
    setCompileResult(null);
    setPdf(null);
    clearOutputLog();
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

  const loadProjectRef = useRef(loadProject);
  loadProjectRef.current = loadProject;

  useEffect(() => {
    const unsubOpened = window.bigTex.project.onOpened((snapshot) => {
      void loadProjectRef.current(snapshot);
    });
    const unsubClosed = window.bigTex.project.onClosed(() => {
      setProject(null);
      setOpenFile(null);
      setCompileResult(null);
      setPdf(null);
      clearOutputLog();
    });
    return () => {
      unsubOpened();
      unsubClosed();
    };
  }, [setProject, setOpenFile, setCompileResult, setPdf, clearOutputLog]);

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
      });
      setCompileResult(result);
      if (result.pdfPath) {
        setPdf(await window.bigTex.latex.readPdf(result.pdfPath));
      }
      if (result.success) {
        appendOutput(`Compiled PDF (${result.durationMs}ms).`, "success");
      } else {
        const { errors, warnings } = countDiagnosticsBySeverity(result.diagnostics);
        appendOutput(
          `Compile finished with ${errors} error(s) and ${warnings} warning(s) (${result.durationMs}ms).`,
          "warning",
        );
        setEditorBottomTab("problems");
        const panel = diagnosticsRef.current;
        if (panel?.isCollapsed()) panel.expand();
      }
    } finally {
      setCompiling(false);
      await refreshMetrics();
    }
  }

  async function goToDiagnosticSource(diagnostic: CompileDiagnostic): Promise<void> {
    if (!project) return;
    const path = normalizeDiagnosticPath(diagnostic.file);
    if (!path || !diagnostic.line) return;

    const projectFile = findProjectFileByPath(project.files, path);
    if (!projectFile) {
      appendOutput(`Could not find ${path} in the project.`, "error");
      setEditorBottomTab("output");
      return;
    }

    await openProjectFile(projectFile);
    setEditorRevealLine(diagnostic.line);
  }

  function handoffDiagnosticToAgent(diagnostic: CompileDiagnostic): void {
    const path = normalizeDiagnosticPath(diagnostic.file);
    appendAgentComposerHandoff(formatAgentHandoffLine(diagnostic), path);

    const panel = agentRef.current;
    if (panel?.isCollapsed()) panel.expand();
  }

  async function runAgent(
    prompt: string,
    modelId: string,
    reasoningLevel: string | null,
  ): Promise<void> {
    if (!project) return;
    const mainFile = project.mainFile ?? openFile?.path ?? null;
    const compileSummary =
      compileResult && mainFile ? formatCompileSummary(compileResult, mainFile) : null;

    await window.bigTex.agent.run({
      rootPath: project.rootPath,
      prompt,
      selectedFiles: mergeAgentSelectedFiles(openFile?.path ?? null, agentHandoffFiles),
      compileSummary,
      modelId,
      reasoningLevel,
    });
  }

  const problemCounts = compileResult
    ? countDiagnosticsBySeverity(compileResult.diagnostics)
    : null;

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
    appendOutput(result.message ? `Patch failed: ${result.message}` : "Patch failed.", "error");
    setEditorBottomTab("output");
  }

  async function createProjectFile(parentPath: string, name: string): Promise<void> {
    if (!project) return;
    try {
      const { snapshot, createdPath } = await window.bigTex.files.create({
        rootPath: project.rootPath,
        parentPath,
        name,
      });
      setProject(snapshot);
      await refreshProjectFiles([createdPath], `Created ${createdPath}.`);
    } catch (error) {
      appendOutput(error instanceof Error ? error.message : "Could not create file", "error");
      setEditorBottomTab("output");
      throw error;
    }
  }

  async function renameProjectPath(path: string, newName: string): Promise<void> {
    if (!project) return;
    try {
      const { snapshot, newPath } = await window.bigTex.files.rename({
        rootPath: project.rootPath,
        path,
        newName,
      });
      setProject(snapshot);
      const wasOpen = openFileRef.current?.path === path;
      if (wasOpen) {
        const file = await window.bigTex.files.read({
          rootPath: project.rootPath,
          path: newPath,
        });
        setOpenFile(file);
        activeDraftRef.current = { path: file.path, content: file.content };
      }
      appendOutput(`Renamed to ${newName}.`, "success");
    } catch (error) {
      appendOutput(error instanceof Error ? error.message : "Rename failed", "error");
      setEditorBottomTab("output");
      throw error;
    }
  }

  async function deleteProjectPath(path: string): Promise<void> {
    if (!project) return;
    try {
      const wasOpen = openFileRef.current?.path === path;
      const snapshot = await window.bigTex.files.delete({
        rootPath: project.rootPath,
        path,
      });
      setProject(snapshot);
      if (wasOpen) {
        setOpenFile(null);
        activeDraftRef.current = null;
      }
      appendOutput("Deleted.", "success");
    } catch (error) {
      appendOutput(error instanceof Error ? error.message : "Delete failed", "error");
      setEditorBottomTab("output");
      throw error;
    }
  }

  return (
    <main className="flex h-screen w-screen flex-col min-h-0 overflow-hidden bg-background">
      <CommandBar
        projectName={project?.name ?? null}
        filePath={openFile?.path ?? null}
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
        {project ? (
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
                onOpenFile={(file) => void openProjectFile(file)}
                onCreateFile={createProjectFile}
                onRenamePath={renameProjectPath}
                onDeletePath={deleteProjectPath}
                onError={(message) => {
                  appendOutput(message, "error");
                  setEditorBottomTab("output");
                }}
              />
            </Panel>

            <Separator
              className={`resize-handle-horizontal ${
                isSidebarCollapsed ? "hidden pointer-events-none" : ""
              }`}
            />

            <Panel defaultSize="84%" className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-hidden">
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
                          revealLine={editorRevealLine}
                          onRevealHandled={() => setEditorRevealLine(null)}
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
                        <EditorBottomPanel
                          activeTab={editorBottomTab}
                          onTabChange={setEditorBottomTab}
                          onOutputTabSelect={() => void refreshMetrics()}
                          result={compileResult}
                          compiling={compiling}
                          onCompile={() => void compile()}
                          onGoToSource={(diagnostic) => void goToDiagnosticSource(diagnostic)}
                          onAgentHandoff={handoffDiagnosticToAgent}
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
                      problemCounts={problemCounts}
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
        ) : (
          <WelcomeScreen onLoadProject={(snapshot) => void loadProject(snapshot)} />
        )}
      </div>
    </main>
  );
}
