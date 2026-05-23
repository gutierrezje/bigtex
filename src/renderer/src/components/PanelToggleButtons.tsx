import { PdfFileIcon } from "./icons/PdfFileIcon";

interface PanelToggleButtonsProps {
  showDiagnostics: boolean;
  onToggleDiagnostics(): void;
  showPdf: boolean;
  onTogglePdf(): void;
  showAgent: boolean;
  onToggleAgent(): void;
}

export function PanelToggleButtons({
  showDiagnostics,
  onToggleDiagnostics,
  showPdf,
  onTogglePdf,
  showAgent,
  onToggleAgent,
}: PanelToggleButtonsProps) {
  const toggleClass = (active: boolean) =>
    `rounded border p-1.5 transition-all duration-100 cursor-pointer ${
      active
        ? "border-accent/20 bg-accent/8 text-text-primary"
        : "border-transparent text-text-muted hover:text-text-secondary"
    }`;

  return (
    <>
      <button
        type="button"
        title="Toggle Problems"
        className={toggleClass(showDiagnostics)}
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
        className={toggleClass(showPdf)}
        onClick={onTogglePdf}
      >
        <PdfFileIcon
          className={`h-3.5 w-3.5 ${showPdf ? "text-text-primary" : "text-text-muted"}`}
        />
      </button>

      <button
        type="button"
        title="Toggle AI Agent Panel"
        className={toggleClass(showAgent)}
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
          <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z" opacity="0.4" />
        </svg>
      </button>
    </>
  );
}
