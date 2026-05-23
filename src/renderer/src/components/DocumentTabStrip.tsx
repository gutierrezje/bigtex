import { TREE_LABEL_CLASS } from "../lib/treeTypography";

export interface DocumentTabItem {
  path: string;
  dirty?: boolean;
}

interface DocumentTabListProps {
  tabs: DocumentTabItem[];
  activePath: string | null;
  onSelect(path: string): void;
  onClose(path: string): void;
  className?: string;
}

function tabLabel(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function DocumentTabList({
  tabs,
  activePath,
  onSelect,
  onClose,
  className = "",
}: DocumentTabListProps) {
  return (
    <div
      className={`flex h-full min-w-0 items-stretch gap-0 overflow-x-auto ${className}`.trim()}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <div
            key={tab.path}
            className={`group flex max-w-[12rem] min-w-0 shrink-0 items-center gap-1 border-r border-border/40 px-1.5 ${
              active ? "bg-surface text-text-primary" : "text-text-muted hover:bg-surface/60"
            }`}
          >
            <button
              type="button"
              className={`flex min-w-0 flex-1 items-center gap-1.5 truncate text-left ${TREE_LABEL_CLASS}`}
              onClick={() => onSelect(tab.path)}
              title={tab.path}
            >
              {tab.dirty ? (
                <span className="h-1 w-1 shrink-0 rounded-full bg-amber-400" aria-hidden />
              ) : null}
              <span className="truncate">{tabLabel(tab.path)}</span>
            </button>
            <button
              type="button"
              className={`shrink-0 rounded p-0.5 ${TREE_LABEL_CLASS} text-text-muted opacity-0 transition-opacity hover:bg-border/40 hover:text-text-secondary group-hover:opacity-100`}
              aria-label={`Close ${tabLabel(tab.path)}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface PdfViewerToggleProps {
  showPdf: boolean;
  onToggle(): void;
  className?: string;
}

export function PdfViewerToggle({
  showPdf,
  onToggle,
  className = "",
  embedded = false,
}: PdfViewerToggleProps & { embedded?: boolean }) {
  const button = (
    <button
      type="button"
      title="Toggle PDF viewer"
      className={`flex cursor-pointer items-center justify-center rounded border p-1.5 leading-none transition-colors duration-200 ${
        showPdf
          ? "border-transparent bg-surface text-text-primary"
          : "border-transparent text-text-muted hover:bg-surface/50 hover:text-text-secondary"
      }`}
      onClick={onToggle}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="block h-3.5 w-3.5 overflow-visible"
        aria-hidden
      >
        <title>Toggle PDF viewer</title>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <line
          x1="12"
          y1="3"
          x2="12"
          y2="21"
          style={{
            transform: showPdf ? "translateX(0px)" : "translateX(9px)",
            opacity: showPdf ? 1 : 0,
            transition: "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-in-out",
          }}
        />
      </svg>
    </button>
  );

  if (embedded) {
    return (
      <div className={`flex w-11 shrink-0 items-center justify-center ${className}`.trim()}>
        {button}
      </div>
    );
  }

  return (
    <div
      className={`flex h-9 w-11 shrink-0 items-center justify-center self-stretch border-l border-border/20 ${className}`.trim()}
    >
      {button}
    </div>
  );
}

/** @deprecated Use DocumentWorkbench tab rows + pinned PdfViewerToggle. */
interface DocumentTabStripProps {
  tabs: DocumentTabItem[];
  activePath: string | null;
  onSelect(path: string): void;
  onClose(path: string): void;
  showPdf?: boolean;
  onTogglePdf?(): void;
}

export function DocumentTabStrip({
  tabs,
  activePath,
  onSelect,
  onClose,
  showPdf,
  onTogglePdf,
}: DocumentTabStripProps) {
  if (tabs.length === 0 && showPdf === undefined) return null;

  return (
    <div className="flex h-9 shrink-0 select-none items-center justify-between border-b border-border/40 bg-surface-raised">
      <DocumentTabList tabs={tabs} activePath={activePath} onSelect={onSelect} onClose={onClose} />
      {showPdf !== undefined && onTogglePdf !== undefined ? (
        <PdfViewerToggle showPdf={showPdf} onToggle={onTogglePdf} />
      ) : null}
    </div>
  );
}
