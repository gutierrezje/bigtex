import { useCallback, useEffect, useRef, useState } from "react";
import type { OnPanelResize, PanelImperativeHandle } from "react-resizable-panels";
import { Group, Panel, Separator } from "react-resizable-panels";
import { getActiveEditor, listDirtyEditorPaths } from "../../shared/documentTabs";
import type { CompileDiagnostic, ProjectFile, ProjectSnapshot } from "../../shared/domain";
import {
  countDiagnosticsBySeverity,
  findProjectFileByPath,
  formatAgentHandoffLine,
  formatCompileSummary,
  mergeAgentSelectedFiles,
  normalizeDiagnosticPath,
} from "../../shared/problems";
import { isPdfPath, toProjectRelativePath } from "../../shared/projectFiles";
import { AgentPanel } from "./components/AgentPanel";
import { CommandBar } from "./components/CommandBar";
import { EditorBottomPanel, type EditorBottomTab } from "./components/EditorBottomPanel";
import { EditorWorkbench } from "./components/EditorWorkbench";
import { PdfViewerWorkbench } from "./components/PdfViewerWorkbench";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useAgentEvents } from "./hooks/useAgentEvents";

import { formatWindowChromeLabel } from "./lib/windowChrome";
import { useAppStore } from "./store";

function selectable(file: ProjectFile): boolean {
  return file.kind !== "folder";
}

function tabLabel(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function collapsiblePanelOnResize(setCollapsed: (collapsed: boolean) => void): OnPanelResize {
  return (size, _id, prev) => {
    if (prev !== undefined) {
      setCollapsed(size.asPercentage < 1);
    }
  };
}

export function App() {
  const {
    project,
    editorTabs,
    pdfTabs,
    compileResult,
    agentChat,
    setProject,
    openEditorFile,
    activateEditorTab,
    closeEditorTabAt,
    updateEditorTabContent,
    replaceEditorTabFile,
    clearEditorTabs,
    openPdfTab,
    activatePdfTab,
    closePdfTabAt,
    clearPdfTabs,
    renameEditorTabPath,
    renamePdfTabPath,
    setCompileResult,
    clearAgent,
    clearOutputLog,
    refreshMetrics,
  } = useAppStore();
  const activeEditor = getActiveEditor(editorTabs);
  const [compiling, setCompiling] = useState(false);
  const [editorRevealLine, setEditorRevealLine] = useState<number | null>(null);
  const [editorBottomTab, setEditorBottomTab] = useState<EditorBottomTab>("problems");
  const appendAgentComposerHandoff = useAppStore((state) => state.appendAgentComposerHandoff);
  const agentHandoffFiles = useAppStore((state) => state.agentHandoffFiles);
  const appendOutput = useAppStore((state) => state.appendOutput);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDiagnosticsCollapsed, setIsDiagnosticsCollapsed] = useState(false);
  const [isPdfCollapsed, setIsPdfCollapsed] = useState(false);
  const [isAgentCollapsed, setIsAgentCollapsed] = useState(false);

  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const diagnosticsRef = useRef<PanelImperativeHandle>(null);
  const pdfRef = useRef<PanelImperativeHandle>(null);
  const agentRef = useRef<PanelImperativeHandle>(null);

  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    document.title = formatWindowChromeLabel(project?.name ?? null, activeEditor?.path ?? null);
  }, [project?.name, activeEditor?.path]);

  const handleToggleSidebar = () => {
    const panel = sidebarRef.current;
    if (panel) {
      if (panel.isCollapsed()) panel.expand();
      else panel.collapse();
    }
  };

  const handleToggleDiagnostics = () => {
    const panel = diagnosticsRef.current;
    if (panel) {
      if (panel.isCollapsed()) panel.expand();
      else panel.collapse();
    }
  };

  const expandPdfPanel = useCallback(() => {
    const panel = pdfRef.current;
    if (panel?.isCollapsed()) panel.expand();
    setIsPdfCollapsed(false);
  }, []);

  const handleTogglePdf = () => {
    const panel = pdfRef.current;
    if (panel) {
      if (panel.isCollapsed()) panel.expand();
      else panel.collapse();
    }
  };

  const loadPdfTab = useCallback(
    async (absolutePath: string, relativePath: string) => {
      const payload = await window.bigTex.latex.readPdf(absolutePath);
      openPdfTab({ ...payload, path: relativePath });
      expandPdfPanel();
    },
    [openPdfTab, expandPdfPanel],
  );

  const handleToggleAgent = () => {
    const panel = agentRef.current;
    if (panel) {
      if (panel.isCollapsed()) panel.expand();
      else panel.collapse();
    }
  };

  const saveEditorTab = useCallback(
    async (path: string, content: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;
      replaceEditorTabFile(
        await window.bigTex.files.write({
          rootPath: currentProject.rootPath,
          path,
          content,
        }),
      );
    },
    [replaceEditorTabFile],
  );

  const flushDirtyEditorTabs = useCallback(async () => {
    for (const path of listDirtyEditorPaths(useAppStore.getState().editorTabs)) {
      const file = useAppStore.getState().editorTabs.files.find((entry) => entry.path === path);
      if (file) await saveEditorTab(path, file.content);
    }
  }, [saveEditorTab]);

  const refreshProjectFiles = useCallback(
    async (paths?: string[], toastMessage?: string) => {
      const currentProject = projectRef.current;
      if (!currentProject) return;

      const refreshed = await window.bigTex.project.load(currentProject.rootPath);
      setProject(refreshed);

      const state = useAppStore.getState();
      const touched = paths ?? [];

      for (const file of state.editorTabs.files) {
        if (
          touched.length === 0 ||
          touched.some((path) => path === file.path || path.endsWith(`/${file.path}`))
        ) {
          const updated = await window.bigTex.files.read({
            rootPath: currentProject.rootPath,
            path: file.path,
          });
          replaceEditorTabFile(updated);
        }
      }

      for (const pdf of state.pdfTabs.pdfs) {
        if (
          touched.length === 0 ||
          touched.some((path) => path === pdf.path || path.endsWith(`/${pdf.path}`))
        ) {
          const match = findProjectFileByPath(refreshed.files, pdf.path);
          if (match) {
            await loadPdfTab(match.absolutePath, match.path);
          }
        }
      }

      if (toastMessage) appendOutput(toastMessage, "success");
    },
    [setProject, replaceEditorTabFile, loadPdfTab, appendOutput],
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
  }, [refreshMetrics]);

  async function loadProject(snapshot: ProjectSnapshot | null): Promise<void> {
    if (!snapshot) return;
    setProject(snapshot);
    setCompileResult(null);
    clearEditorTabs();
    clearPdfTabs();
    clearOutputLog();
    clearAgent();
    void useAppStore.getState().loadAgentConfig(snapshot.rootPath);

    if (snapshot.mainFile) {
      openEditorFile(
        await window.bigTex.files.read({
          rootPath: snapshot.rootPath,
          path: snapshot.mainFile,
        }),
      );
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
      clearEditorTabs();
      clearPdfTabs();
      setCompileResult(null);
      clearOutputLog();
    });
    return () => {
      unsubOpened();
      unsubClosed();
    };
  }, [setProject, clearEditorTabs, clearPdfTabs, setCompileResult, clearOutputLog]);

  async function openProjectFile(file: ProjectFile): Promise<void> {
    if (!project || !selectable(file)) return;
    if (isPdfPath(file.path)) {
      await loadPdfTab(file.absolutePath, file.path);
      return;
    }
    openEditorFile(
      await window.bigTex.files.read({
        rootPath: project.rootPath,
        path: file.path,
      }),
    );
  }

  function requestCloseEditorTab(path: string): void {
    const file = editorTabs.files.find((entry) => entry.path === path);
    if (file?.dirty && !window.confirm(`Discard unsaved changes to ${tabLabel(path)}?`)) {
      return;
    }
    closeEditorTabAt(path);
  }

  async function compile(): Promise<void> {
    if (!project) return;
    const mainFile = project.mainFile ?? activeEditor?.path;
    if (!mainFile) return;

    setCompiling(true);
    try {
      await flushDirtyEditorTabs();

      const result = await window.bigTex.latex.compile({
        rootPath: project.rootPath,
        mainFile,
      });
      setCompileResult(result);
      if (result.pdfPath) {
        await loadPdfTab(result.pdfPath, toProjectRelativePath(project.rootPath, result.pdfPath));
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
    const mainFile = project.mainFile ?? activeEditor?.path ?? null;
    const compileSummary =
      compileResult && mainFile ? formatCompileSummary(compileResult, mainFile) : null;

    await window.bigTex.agent.run({
      rootPath: project.rootPath,
      prompt,
      selectedFiles: mergeAgentSelectedFiles(activeEditor?.path ?? null, agentHandoffFiles),
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
      const created = findProjectFileByPath(snapshot.files, createdPath);
      if (created && !isPdfPath(created.path)) {
        await openProjectFile(created);
      }
      appendOutput(`Created ${createdPath}.`, "success");
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

      const hadEditorTab = useAppStore
        .getState()
        .editorTabs.files.some((file) => file.path === path);
      const hadPdfTab = useAppStore.getState().pdfTabs.pdfs.some((pdf) => pdf.path === path);

      if (hadEditorTab) {
        const file = await window.bigTex.files.read({
          rootPath: project.rootPath,
          path: newPath,
        });
        renameEditorTabPath(path, newPath, file);
      }
      if (hadPdfTab) {
        renamePdfTabPath(path, newPath);
        const match = findProjectFileByPath(snapshot.files, newPath);
        if (match) {
          await loadPdfTab(match.absolutePath, newPath);
        }
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
      const snapshot = await window.bigTex.files.delete({
        rootPath: project.rootPath,
        path,
      });
      setProject(snapshot);
      closeEditorTabAt(path);
      closePdfTabAt(path);
      appendOutput("Deleted.", "success");
    } catch (error) {
      appendOutput(error instanceof Error ? error.message : "Delete failed", "error");
      setEditorBottomTab("output");
      throw error;
    }
  }

  return (
    <main
      data-testid="editor-root"
      className="flex h-screen w-screen flex-col min-h-0 overflow-hidden bg-background"
    >
      <CommandBar
        projectName={project?.name ?? null}
        filePath={activeEditor?.path ?? null}
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
              onResize={collapsiblePanelOnResize(setIsSidebarCollapsed)}
              className="h-full min-h-0 min-w-0"
            >
              <ProjectSidebar
                project={project}
                activePath={activeEditor?.path ?? null}
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
              <Group
                className="h-full min-h-0 min-w-0"
                id="bigtex-center-stack"
                orientation="vertical"
              >
                <Panel defaultSize="78%" minSize="40%" className="min-h-0 min-w-0">
                  <Group
                    className="h-full min-h-0 min-w-0"
                    id="bigtex-document-panels"
                    orientation="horizontal"
                  >
                    <Panel defaultSize="52%" minSize="25%" className="min-h-0 min-w-0">
                      <EditorWorkbench
                        tabs={editorTabs}
                        diagnostics={compileResult?.diagnostics ?? []}
                        revealLine={editorRevealLine}
                        onRevealHandled={() => setEditorRevealLine(null)}
                        onSelectTab={activateEditorTab}
                        onCloseTab={requestCloseEditorTab}
                        onDraftChange={updateEditorTabContent}
                        onSave={saveEditorTab}
                      />
                    </Panel>

                    <Separator
                      className={`resize-handle-horizontal ${
                        isPdfCollapsed ? "hidden pointer-events-none" : ""
                      }`}
                    />

                    <Panel
                      panelRef={pdfRef}
                      collapsible={true}
                      defaultSize="48%"
                      minSize="20%"
                      onResize={collapsiblePanelOnResize(setIsPdfCollapsed)}
                      className="min-h-0 min-w-0"
                    >
                      <PdfViewerWorkbench
                        tabs={pdfTabs}
                        onSelectTab={activatePdfTab}
                        onCloseTab={closePdfTabAt}
                      />
                    </Panel>
                  </Group>
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
                  onResize={collapsiblePanelOnResize(setIsDiagnosticsCollapsed)}
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
                isAgentCollapsed ? "hidden pointer-events-none" : ""
              }`}
            />

            <Panel
              panelRef={agentRef}
              collapsible={true}
              defaultSize="27%"
              minSize="20%"
              onResize={collapsiblePanelOnResize(setIsAgentCollapsed)}
              className="min-h-0 min-w-0"
            >
              <AgentPanel
                rootPath={project?.rootPath ?? null}
                activeFile={activeEditor?.path ?? null}
                problemCounts={problemCounts}
                chat={agentChat}
                onRun={runAgent}
                onCancel={(runId) => window.bigTex.agent.cancel({ runId })}
                onApplyPatch={applyPatch}
              />
            </Panel>
          </Group>
        ) : (
          <WelcomeScreen onLoadProject={(snapshot) => void loadProject(snapshot)} />
        )}
      </div>
    </main>
  );
}
