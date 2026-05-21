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
    <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 bg-zinc-950 select-none">
      <TitleBar projectName={projectName} filePath={filePath} />

      <div
        className="flex shrink-0 items-center gap-1 rounded-md border border-border/40 bg-zinc-900/60 p-0.5 px-4"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          title="Toggle Sidebar (Files)"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showSidebar
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
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

        <button
          type="button"
          title="Toggle Problems"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showDiagnostics
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
          onClick={onToggleDiagnostics}
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
            <title>Toggle Problems</title>
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 15h18" />
            <path d="m8 9 2 2-2 2" />
          </svg>
        </button>

        <button
          type="button"
          title="Toggle PDF viewer"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showPdf
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
          onClick={onTogglePdf}
        >
          <PdfFileIcon className={`h-3.5 w-3.5 ${showPdf ? "" : "opacity-55"}`} />
        </button>

        <button
          type="button"
          title="Toggle AI Agent Panel"
          className={`p-1.5 rounded-md transition-all duration-100 cursor-pointer ${
            showAgent
              ? "bg-accent/15 text-accent shadow-sm border border-accent/20"
              : "text-text-muted hover:text-text-secondary border border-transparent"
          }`}
          onClick={onToggleAgent}
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
            <title>Toggle AI Agent</title>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z" opacity="0.6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
