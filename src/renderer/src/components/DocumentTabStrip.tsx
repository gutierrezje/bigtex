import { TREE_LABEL_CLASS } from "../lib/treeTypography";

export interface DocumentTabItem {
  path: string;
  dirty?: boolean;
}

interface DocumentTabStripProps {
  tabs: DocumentTabItem[];
  activePath: string | null;
  onSelect(path: string): void;
  onClose(path: string): void;
  showPdf?: boolean;
  onTogglePdf?(): void;
}

function tabLabel(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function DocumentTabStrip({
  tabs,
  activePath,
  onSelect,
  onClose,
  showPdf,
  onTogglePdf,
}: DocumentTabStripProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 bg-surface-raised select-none">
      {/* Scrollable Tabs Container */}
      <div className="flex h-full flex-1 items-stretch gap-0 overflow-x-auto" role="tablist">
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

      {/* PDF Viewer Toggle (Justified to the far right, pinned) */}
      {showPdf !== undefined && onTogglePdf !== undefined && (
        <div className="flex h-full shrink-0 items-center border-l border-border/20 px-2">
          <button
            type="button"
            title="Toggle PDF viewer"
            className={`rounded border p-1.5 transition-all duration-200 cursor-pointer ${
              showPdf
                ? "border-transparent bg-surface text-text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface/50"
            }`}
            onClick={onTogglePdf}
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
                  transition:
                    "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-in-out",
                }}
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
