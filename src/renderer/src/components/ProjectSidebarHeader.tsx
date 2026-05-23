import type { ReactNode } from "react";
import { TREE_LABEL_CLASS } from "../lib/treeTypography";

interface ExplorerToolbarButtonProps {
  title: string;
  onClick(): void;
  children: ReactNode;
}

function ExplorerToolbarButton({ title, onClick, children }: ExplorerToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-text-muted transition-colors hover:bg-white/6 hover:text-text-primary"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface ProjectSidebarHeaderProps {
  projectName: string;
  onNewFile(): void;
  onCollapseAll(): void;
  onRefresh(): void;
}

export function ProjectSidebarHeader({
  projectName,
  onNewFile,
  onCollapseAll,
  onRefresh,
}: ProjectSidebarHeaderProps) {
  return (
    <header className="flex h-9 shrink-0 items-center gap-1 border-b border-border/40 bg-surface-raised px-2 select-none">
      <h2
        className={`min-w-0 flex-1 truncate font-medium text-text-secondary ${TREE_LABEL_CLASS}`}
        title={projectName}
      >
        {projectName}
      </h2>
      <div className="flex shrink-0 items-center">
        <ExplorerToolbarButton title="New File…" onClick={onNewFile}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="block h-3.5 w-3.5"
            aria-hidden
          >
            <title>New File</title>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </ExplorerToolbarButton>
        <ExplorerToolbarButton title="Collapse All" onClick={onCollapseAll}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="block h-3.5 w-3.5"
            aria-hidden
          >
            <title>Collapse All</title>
            <path d="m4 14 4-4 4 4" />
            <path d="M4 10h16" />
            <path d="m4 6 4 4 4-4" />
          </svg>
        </ExplorerToolbarButton>
        <ExplorerToolbarButton title="Refresh Explorer" onClick={onRefresh}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="block h-3.5 w-3.5"
            aria-hidden
          >
            <title>Refresh</title>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </ExplorerToolbarButton>
      </div>
    </header>
  );
}
