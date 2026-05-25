import { getActiveEditor } from "../../../shared/documentTabs";
import { useAppStore } from "../store";

async function bootstrapBlankProject(rootPath: string): Promise<void> {
  const snapshot = await window.bigTex.project.load(rootPath);
  const state = useAppStore.getState();
  state.setProject(snapshot);
  state.setCompileResult(null);
  state.clearEditorTabs();
  state.clearPdfTabs();
  state.clearOutputLog();
  state.clearAgent();
  void state.loadAgentConfig(snapshot.rootPath);

  if (snapshot.mainFile) {
    state.openEditorFile(
      await window.bigTex.files.read({
        rootPath: snapshot.rootPath,
        path: snapshot.mainFile,
      }),
    );
  }
  performance.mark("bigtex:project-loaded");
}

async function stressStoreUpdates(iterations: number): Promise<void> {
  const tabs = useAppStore.getState().editorTabs;
  const active = getActiveEditor(tabs);
  if (!active) {
    throw new Error("No active editor — bootstrap a project first");
  }

  performance.mark("bigtex:store-stress-start");
  const update = useAppStore.getState().updateEditorTabContent;
  for (let i = 0; i < iterations; i++) {
    update(active.path, `${active.content}\n% stress line ${i}`);
  }
  performance.mark("bigtex:store-stress-end");
  performance.measure(
    "bigtex:store-stress",
    "bigtex:store-stress-start",
    "bigtex:store-stress-end",
  );
}

function getUserTimingEntries(): PerformanceEntry[] {
  return [...performance.getEntriesByType("mark"), ...performance.getEntriesByType("measure")];
}

export function installBigTexPerfBridge(): void {
  if (!import.meta.env.VITE_BIGTEX_PERF) return;

  const bridge = {
    bootstrapBlankProject,
    stressStoreUpdates,
    getUserTimingEntries,
  };

  window.__BIGTEX_PERF__ = bridge;
}
