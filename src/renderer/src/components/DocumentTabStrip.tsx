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
}

function tabLabel(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function DocumentTabStrip({ tabs, activePath, onSelect, onClose }: DocumentTabStripProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      className="flex h-12 shrink-0 items-stretch gap-0 overflow-x-auto border-b border-border/40 bg-surface-raised"
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
