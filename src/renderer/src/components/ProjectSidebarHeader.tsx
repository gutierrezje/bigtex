import type { ReactNode } from "react";
import { CHROME_TITLE_CLASS, PANEL_CHROME_ROW_CLASS } from "../lib/treeTypography";
import { IconTooltipButton } from "./IconTooltipButton";

const EXPLORER_TOOLBAR_ICON_CLASS = "block h-4 w-4";

interface ExplorerToolbarButtonProps {
  title: string;
  onClick(): void;
  children: ReactNode;
}

function ExplorerToolbarButton({ title, onClick, children }: ExplorerToolbarButtonProps) {
  return (
    <IconTooltipButton
      hint={title}
      tooltipPlacement="left"
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-text-muted transition-colors hover:bg-white/6 hover:text-text-primary"
    >
      {children}
    </IconTooltipButton>
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
    <header
      className={`${PANEL_CHROME_ROW_CLASS} relative z-30 shrink-0 gap-1 overflow-visible px-2`}
    >
      <h2
        className={`min-w-0 flex-1 truncate text-text-secondary ${CHROME_TITLE_CLASS}`}
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
            className={EXPLORER_TOOLBAR_ICON_CLASS}
            aria-hidden
          >
            <title>New File…</title>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </ExplorerToolbarButton>
        <ExplorerToolbarButton title="Fold all folders" onClick={onCollapseAll}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={EXPLORER_TOOLBAR_ICON_CLASS}
            aria-hidden
          >
            <title>Fold all folders</title>
            <path d="M12 4v3M8 7l4 3 4-3" />
            <path d="M12 20v-3M8 15l4 3 4-3" />
          </svg>
        </ExplorerToolbarButton>
        <ExplorerToolbarButton title="Refresh explorer" onClick={onRefresh}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={EXPLORER_TOOLBAR_ICON_CLASS}
            aria-hidden
          >
            <title>Refresh explorer</title>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </ExplorerToolbarButton>
      </div>
    </header>
  );
}
