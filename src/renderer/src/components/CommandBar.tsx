import { PdfFileIcon } from "./icons/PdfFileIcon";
import { TitleBar } from "./TitleBar";

interface CommandBarProps {
  projectName: string | null;
  filePath: string | null;
  showSidebar: boolean;
  onToggleSidebar(): void;
  showDiagnostics: boolean;
  onToggleDiagnostics(): void;
  showPdf: boolean;
  onTogglePdf(): void;
  showAgent: boolean;
  onToggleAgent(): void;
}

export function CommandBar({
  projectName,
  filePath,
  showSidebar,
  onToggleSidebar,
  showDiagnostics,
  onToggleDiagnostics,
  showPdf,
  onTogglePdf,
  showAgent,
  onToggleAgent,
}: CommandBarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-surface-raised select-none">
      <TitleBar projectName={projectName} filePath={filePath} />

      {!showSidebar ? (
        <div
          className="flex shrink-0 items-center gap-1 rounded border border-border/30 bg-surface-inset p-0.5 px-2 mr-4"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            type="button"
            title="Toggle Sidebar (Files)"
            className="p-1.5 rounded transition-all duration-100 cursor-pointer text-text-muted hover:text-text-secondary border border-transparent"
            onClick={onToggleSidebar}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <title>Toggle Sidebar</title>
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
