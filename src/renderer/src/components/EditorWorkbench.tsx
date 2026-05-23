import type { EditorTabsState } from "../../../shared/documentTabs";
import { getActiveEditor } from "../../../shared/documentTabs";
import type { CompileDiagnostic } from "../../../shared/domain";
import { DocumentTabStrip } from "./DocumentTabStrip";
import { EditorPane } from "./EditorPane";

interface EditorWorkbenchProps {
  tabs: EditorTabsState;
  diagnostics: CompileDiagnostic[];
  revealLine: number | null;
  onRevealHandled(): void;
  onSelectTab(path: string): void;
  onCloseTab(path: string): void;
  onDraftChange(path: string, content: string): void;
  onSave(path: string, content: string): void | Promise<void>;
  showPdf: boolean;
  onTogglePdf(): void;
}

export function EditorWorkbench({
  tabs,
  diagnostics,
  revealLine,
  onRevealHandled,
  onSelectTab,
  onCloseTab,
  onDraftChange,
  onSave,
  showPdf,
  onTogglePdf,
}: EditorWorkbenchProps) {
  const activeFile = getActiveEditor(tabs);

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <DocumentTabStrip
        tabs={tabs.files.map((file) => ({ path: file.path, dirty: file.dirty }))}
        activePath={tabs.activePath}
        onSelect={onSelectTab}
        onClose={onCloseTab}
        showPdf={showPdf}
        onTogglePdf={onTogglePdf}
      />
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
    </div>
  );
}
