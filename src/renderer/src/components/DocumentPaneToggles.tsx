import { PdfViewerToggle } from "./DocumentTabStrip";
import { IconTooltipButton } from "./IconTooltipButton";
import { PdfInvertIcon } from "./icons/PdfInvertIcon";

const paneToggleButtonClass =
  "flex cursor-pointer items-center justify-center rounded border p-1.5 leading-none transition-colors duration-200";

interface DocumentPaneTogglesProps {
  showPdf: boolean;
  pdfPreviewInverted: boolean;
  onTogglePdf(): void;
  onTogglePdfPreviewInvert(): void;
  className?: string;
}

/** Pinned editor/PDF chrome: invert preview (left), split viewer (right). */
export function DocumentPaneToggles({
  showPdf,
  pdfPreviewInverted,
  onTogglePdf,
  onTogglePdfPreviewInvert,
  className = "",
}: DocumentPaneTogglesProps) {
  return (
    <div
      className={`flex h-9 shrink-0 items-stretch overflow-visible border-l border-border/20 ${className}`.trim()}
    >
      <div className="flex w-11 shrink-0 items-center justify-center border-r border-border/20">
        <IconTooltipButton
          hint={pdfPreviewInverted ? "Original" : "Invert"}
          tooltipPlacement="left"
          aria-pressed={pdfPreviewInverted}
          onClick={onTogglePdfPreviewInvert}
          className={`${paneToggleButtonClass} ${
            pdfPreviewInverted
              ? "border-transparent bg-surface text-text-primary"
              : "border-transparent text-text-muted hover:bg-surface/50 hover:text-text-secondary"
          }`}
        >
          <PdfInvertIcon inverted={pdfPreviewInverted} />
        </IconTooltipButton>
      </div>
      <PdfViewerToggle showPdf={showPdf} onToggle={onTogglePdf} embedded />
    </div>
  );
}
