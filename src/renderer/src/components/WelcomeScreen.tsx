import { useEffect, useState } from "react";
import type { ProjectSnapshot, RecentProject } from "../../../shared/domain";

interface WelcomeScreenProps {
  onLoadProject(snapshot: ProjectSnapshot): void;
}

export function WelcomeScreen({ onLoadProject }: WelcomeScreenProps) {
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Opening workspace...");

  // Load recents on mount
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const list = await window.bigTex.recents.get();
        if (active) setRecents(list);
      } catch (err) {
        console.error("Failed to load recents", err);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleOpenFolder = async () => {
    try {
      const snapshot = await window.bigTex.project.openDialog();
      if (snapshot) {
        setLoadingText("Loading project files...");
        setLoading(true);
        // Add artificial delays to allow transitions to wow the user
        await new Promise((r) => setTimeout(r, 600));
        onLoadProject(snapshot);
      }
    } catch (err) {
      console.error("Failed to open folder", err);
      alert(err instanceof Error ? err.message : "Failed to open folder");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSample = async () => {
    try {
      setLoadingText("Copying sample workspace...");
      setLoading(true);
      const snapshot = await window.bigTex.project.loadSample();
      await new Promise((r) => setTimeout(r, 850));
      onLoadProject(snapshot);
    } catch (err) {
      console.error("Failed to load sample project", err);
      alert(err instanceof Error ? err.message : "Failed to load sample");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPath = async (path: string) => {
    try {
      setLoadingText(`Loading ${path.split("/").pop() || "workspace"}...`);
      setLoading(true);
      const snapshot = await window.bigTex.project.load(path);
      await new Promise((r) => setTimeout(r, 600));
      onLoadProject(snapshot);
    } catch (err) {
      console.error("Failed to load project", err);
      // Remove bad paths from recents list automatically
      const updated = await window.bigTex.recents.remove(path);
      setRecents(updated);
      alert(`Could not open project at ${path}. It may have been moved or deleted.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      const updated = await window.bigTex.recents.remove(path);
      setRecents(updated);
    } catch (err) {
      console.error("Failed to remove recent", err);
    }
  };

  const handleClearRecents = async () => {
    if (!window.confirm("Clear all recently opened workspaces from history?")) return;
    try {
      await window.bigTex.recents.clear();
      setRecents([]);
    } catch (err) {
      console.error("Failed to clear recents", err);
    }
  };

  // Format date helper
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-surface text-text-primary welcome-fade-in select-none">
      {/* Main two-column dashboard */}
      <div className="z-10 grid w-full max-w-5xl grid-cols-1 gap-12 px-6 md:grid-cols-12">
        {/* Left Column: branding and main actions */}
        <section className="welcome-slide-up flex flex-col justify-center md:col-span-5">
          <div className="flex items-center gap-3.5 mb-5">
            <span className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-surface-inset text-md font-bold tracking-tight text-text-secondary select-none">
              bt
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-text-primary leading-none">
                BigTeX
              </h1>
              <p className="text-[10px] font-medium text-accent tracking-wider uppercase mt-1">
                Agent-first LaTeX workspace
              </p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-text-secondary mb-8 pr-4">
            Welcome to the early MVP LaTeX desktop environment. BigTeX streamlines documents with
            integrated deep agents, real-time local compilation, and diagnostic assistance.
          </p>

          <div className="flex flex-col gap-4">
            {/* Open Folder Card */}
            <button
              onClick={handleOpenFolder}
              className="welcome-card-flat text-left p-4 rounded-lg flex items-center gap-4 cursor-pointer group outline-none"
              type="button"
            >
              <div className="p-2.5 rounded-md bg-surface-raised border border-border text-text-muted group-hover:text-text-primary transition-colors duration-150">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <title>Folder Icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-18.75 0a2.25 2.25 0 0 0-2.25 2.25v3.75c0 1.242 1.008 2.25 2.25 2.25h15A2.25 2.25 0 0 0 21.75 19v-3.75a2.25 2.25 0 0 0-2.25-2.25m-18.75 0h18.75V12a2.25 2.25 0 0 0-2.25-2.25H12m0 0V5.25A2.25 2.25 0 0 0 9.75 3h-4.5A2.25 2.25 0 0 0 3 5.25V9.75"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-text-primary text-xs group-hover:text-accent transition-colors duration-150">
                  Open folder...
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Select a LaTeX folder from your disk
                </p>
              </div>
            </button>

            {/* Load Sample Project */}
            <button
              data-testid="welcome-open-sample"
              onClick={handleOpenSample}
              className="welcome-card-flat text-left p-4 rounded-lg flex items-center gap-4 cursor-pointer group outline-none"
              type="button"
            >
              <div className="p-2.5 rounded-md bg-surface-raised border border-border text-text-muted group-hover:text-text-primary transition-colors duration-150">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <title>Sample Document Icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-text-primary text-xs group-hover:text-accent transition-colors duration-150">
                  Open sample project
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Launch the minimal smoke test workspace
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Right Column: Recent workspaces list */}
        <section className="welcome-slide-up delay-100 md:col-span-7 flex flex-col justify-center">
          <header className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
            <h2 className="text-[10px] font-semibold tracking-wider uppercase text-text-muted/80">
              Recent workspaces
            </h2>
            {recents.length > 0 ? (
              <button
                type="button"
                onClick={handleClearRecents}
                className="text-[11px] text-text-muted hover:text-rose-400 font-normal transition-colors cursor-pointer"
              >
                Clear history
              </button>
            ) : null}
          </header>

          <div className="flex-1 max-h-[360px] overflow-y-auto pr-1">
            {recents.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {recents.map((item) => (
                  <li key={item.path}>
                    <div className="welcome-recent-item flex w-full items-center justify-between gap-2 rounded-lg border border-border/20 bg-surface-inset p-1 hover:border-border/40 transition-all duration-150">
                      <button
                        type="button"
                        onClick={() => handleOpenPath(item.path)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left cursor-pointer outline-none hover:bg-surface-raised/40"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-4 w-4 shrink-0 text-text-muted/80"
                        >
                          <title>Project Folder</title>
                          <path d="M19.5 21a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.379a1.5 1.5 0 0 1-1.06-.44L11.44 3.938A3 3 0 0 0 9.318 3H4.5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15Z" />
                        </svg>
                        <div className="min-w-0">
                          <h4 className="truncate text-xs font-semibold leading-tight text-text-secondary hover:text-text-primary transition-colors">
                            {item.name}
                          </h4>
                          <p
                            className="mt-0.5 max-w-[420px] truncate font-mono text-[10px] text-text-muted/80"
                            title={item.path}
                          >
                            {item.path}
                          </p>
                        </div>
                      </button>
                      <div className="flex shrink-0 items-center gap-2 pr-2">
                        <span className="text-[10px] text-text-muted/80">
                          {formatDate(item.lastOpened)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRecent(e, item.path)}
                          className="welcome-recent-delete-btn rounded p-1 text-text-muted transition-colors duration-150 hover:text-rose-400"
                          title="Remove from history"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                            className="h-3.5 w-3.5"
                          >
                            <title>Delete Icon</title>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center border border-dashed border-border/60 rounded-xl py-12 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="h-10 w-10 text-text-muted mb-3"
                >
                  <title>Empty Workspace Icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
                  />
                </svg>
                <h4 className="text-sm font-semibold text-text-secondary">No recent projects</h4>
                <p className="text-xs text-text-muted mt-1 max-w-[240px] leading-normal">
                  Open a folder or choose the sample workspace to start working.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modern, organic loading transition overlay */}
      {loading ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md transition-all duration-300 welcome-fade-in">
          <div className="welcome-spinner-ring" />
          <p className="mt-4 text-sm font-medium text-text-secondary tracking-wide animate-pulse">
            {loadingText}
          </p>
        </div>
      ) : null}
    </div>
  );
}
