import type { ReactNode, RefObject } from "react";
import type { OnPanelResize, PanelImperativeHandle } from "react-resizable-panels";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { EditorTabsState, PdfTabsState } from "../../../shared/documentTabs";
import { getActiveEditor, getActivePdf } from "../../../shared/documentTabs";
import type { CompileDiagnostic } from "../../../shared/domain";
import { PANEL_CHROME_ROW_CLASS } from "../lib/treeTypography";
import { DocumentPaneToggles } from "./DocumentPaneToggles";
import { DocumentTabList } from "./DocumentTabStrip";
import { EditorPane } from "./EditorPane";
import { PdfPreview } from "./PdfPreview";

const DEFAULT_EDITOR_PANE_PERCENT = 52;
/** Matches DocumentPaneToggles width (invert + split) so tabs do not sit under pinned controls. */
const PDF_TOGGLE_GUTTER_CLASS = "pr-[5.5rem]";

interface DocumentWorkbenchProps {
  editorTabs: EditorTabsState;
  pdfTabs: PdfTabsState;
  diagnostics: CompileDiagnostic[];
  revealLine: number | null;
  showPdf: boolean;
  pdfPanelRef: RefObject<PanelImperativeHandle | null>;
  onRevealHandled(): void;
  onSelectEditorTab(path: string): void;
  onCloseEditorTab(path: string): void;
  onSelectPdfTab(path: string): void;
  onClosePdfTab(path: string): void;
  onDraftChange(path: string, content: string): void;
  onSave(path: string, content: string): void | Promise<void>;
  onTogglePdf(): void;
  pdfPreviewInverted: boolean;
  onTogglePdfPreviewInvert(): void;
  onPdfPanelResize: OnPanelResize;
}

function DocumentTabRow({ tabList, className = "" }: { tabList: ReactNode; className?: string }) {
  return (
    <div className={`${PANEL_CHROME_ROW_CLASS} items-stretch overflow-hidden ${className}`.trim()}>
      {tabList}
    </div>
  );
}

function DocumentPanelChrome({ tabRow, children }: { tabRow: ReactNode; children: ReactNode }) {
  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      {tabRow}
      {children}
    </div>
  );
}

export function DocumentWorkbench({
  editorTabs,
  pdfTabs,
  diagnostics,
  revealLine,
  showPdf,
  pdfPanelRef,
  onRevealHandled,
  onSelectEditorTab,
  onCloseEditorTab,
  onSelectPdfTab,
  onClosePdfTab,
  onDraftChange,
  onSave,
  onTogglePdf,
  pdfPreviewInverted,
  onTogglePdfPreviewInvert,
  onPdfPanelResize,
}: DocumentWorkbenchProps) {
  const activeFile = getActiveEditor(editorTabs);
  const activePdf = getActivePdf(pdfTabs);

  const editorTabRow = (
    <DocumentTabRow
      className={showPdf ? "" : PDF_TOGGLE_GUTTER_CLASS}
      tabList={
        <DocumentTabList
          tabs={editorTabs.files.map((file) => ({ path: file.path, dirty: file.dirty }))}
          activePath={editorTabs.activePath}
          onSelect={onSelectEditorTab}
          onClose={onCloseEditorTab}
          className="min-w-0 flex-1"
        />
      }
    />
  );

  const pdfTabRow = (
    <DocumentTabRow
      className={showPdf ? PDF_TOGGLE_GUTTER_CLASS : ""}
      tabList={
        <DocumentTabList
          tabs={pdfTabs.pdfs.map((pdf) => ({ path: pdf.path }))}
          activePath={pdfTabs.activePath}
          onSelect={onSelectPdfTab}
          onClose={onClosePdfTab}
          className="min-w-0 flex-1 border-l border-border/40"
        />
      }
    />
  );

  return (
    <div className="relative h-full min-h-0 min-w-0">
      <Group
        className="h-full min-h-0 min-w-0"
        id="bigtex-document-panels"
        orientation="horizontal"
      >
        <Panel
          id="document-editor"
          defaultSize={`${DEFAULT_EDITOR_PANE_PERCENT}%`}
          minSize="25%"
          className="min-h-0 min-w-0"
        >
          <DocumentPanelChrome tabRow={editorTabRow}>
            <EditorPane
              file={activeFile}
              diagnostics={diagnostics}
              revealLine={revealLine}
              onRevealHandled={onRevealHandled}
              onDraftChange={onDraftChange}
              onSave={(content) => {
                if (!activeFile) return;
                return onSave(activeFile.path, content);
              }}
            />
          </DocumentPanelChrome>
        </Panel>

        <Separator
          className={`resize-handle-horizontal ${showPdf ? "" : "hidden pointer-events-none"}`}
        />

        <Panel
          id="document-pdf"
          panelRef={pdfPanelRef}
          collapsible={true}
          defaultSize={`${100 - DEFAULT_EDITOR_PANE_PERCENT}%`}
          minSize="20%"
          onResize={onPdfPanelResize}
          className="min-h-0 min-w-0"
        >
          <DocumentPanelChrome tabRow={pdfTabRow}>
            <PdfPreview pdf={activePdf} invert={pdfPreviewInverted} />
          </DocumentPanelChrome>
        </Panel>
      </Group>

      {/* Single mount so the divider stroke can animate across toggles. */}
      <DocumentPaneToggles
        showPdf={showPdf}
        pdfPreviewInverted={pdfPreviewInverted}
        onTogglePdf={onTogglePdf}
        onTogglePdfPreviewInvert={onTogglePdfPreviewInvert}
        className="absolute top-0 right-0 z-20 border-b border-border/40 bg-surface-raised"
      />
    </div>
  );
}
