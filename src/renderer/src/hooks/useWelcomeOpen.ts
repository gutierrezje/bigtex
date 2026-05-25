import { useCallback, useEffect, useState } from "react";
import type { ProjectSnapshot, RecentProject } from "../../../shared/domain";

export interface UseWelcomeOpenOptions {
  hasProject: boolean;
  loadProject(snapshot: ProjectSnapshot): void | Promise<void>;
}

export function useWelcomeOpen({ hasProject, loadProject }: UseWelcomeOpenOptions) {
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [opening, setOpening] = useState(false);

  const refreshRecents = useCallback(async () => {
    try {
      setRecents(await window.bigTex.recents.get());
    } catch (err) {
      console.error("Failed to load recents", err);
    }
  }, []);

  useEffect(() => {
    if (!hasProject) void refreshRecents();
  }, [hasProject, refreshRecents]);

  const openProject = useCallback(
    async (
      load: () => Promise<ProjectSnapshot | null>,
      options: { failureMessage: string; recentPath?: string },
    ): Promise<void> => {
      setOpening(true);
      try {
        const snapshot = await load();
        if (snapshot) await loadProject(snapshot);
      } catch (err) {
        console.error(options.failureMessage, err);
        if (options.recentPath) {
          setRecents(await window.bigTex.recents.remove(options.recentPath));
          alert(
            `Could not open project at ${options.recentPath}. It may have been moved or deleted.`,
          );
        } else {
          alert(err instanceof Error ? err.message : options.failureMessage);
        }
      } finally {
        setOpening(false);
      }
    },
    [loadProject],
  );

  const onOpenFolder = useCallback(
    () =>
      void openProject(() => window.bigTex.project.openDialog(), {
        failureMessage: "Failed to open folder",
      }),
    [openProject],
  );

  const onCreateProject = useCallback(
    () =>
      void openProject(() => window.bigTex.project.createDialog(), {
        failureMessage: "Failed to create project",
      }),
    [openProject],
  );

  const onOpenRecent = useCallback(
    (path: string) =>
      void openProject(() => window.bigTex.project.load(path), {
        failureMessage: "Failed to load project",
        recentPath: path,
      }),
    [openProject],
  );

  const onRemoveRecent = useCallback(async (path: string) => {
    try {
      setRecents(await window.bigTex.recents.remove(path));
    } catch (err) {
      console.error("Failed to remove recent", err);
    }
  }, []);

  const onClearRecents = useCallback(async () => {
    if (!window.confirm("Clear all recently opened workspaces from history?")) return;
    try {
      await window.bigTex.recents.clear();
      setRecents([]);
    } catch (err) {
      console.error("Failed to clear recents", err);
    }
  }, []);

  return {
    recents,
    opening,
    onOpenFolder,
    onCreateProject,
    onOpenRecent,
    onRemoveRecent,
    onClearRecents,
  };
}
