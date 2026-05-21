import type { PdfTabsState } from "../../../shared/documentTabs";
import { getActivePdf } from "../../../shared/documentTabs";
import { DocumentTabStrip } from "./DocumentTabStrip";
import { PdfPreview } from "./PdfPreview";

interface PdfViewerWorkbenchProps {
  tabs: PdfTabsState;
  onSelectTab(path: string): void;
  onCloseTab(path: string): void;
}

export function PdfViewerWorkbench({ tabs, onSelectTab, onCloseTab }: PdfViewerWorkbenchProps) {
  const activePdf = getActivePdf(tabs);

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <DocumentTabStrip
        tabs={tabs.pdfs.map((pdf) => ({ path: pdf.path }))}
        activePath={tabs.activePath}
        onSelect={onSelectTab}
        onClose={onCloseTab}
      />
      <PdfPreview pdf={activePdf} />
    </div>
  );
}
