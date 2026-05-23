import type { ReactNode } from "react";
import type { FileKind } from "../../../../shared/domain";
import { isPdfPath } from "../../../../shared/projectFiles";

/** Shared 16px tree glyph box — use on all explorer row icons. */
export const TREE_ICON_CLASS = "block h-4 w-4 shrink-0";

const STROKE = {
  width: 2,
  linecap: "round" as const,
  linejoin: "round" as const,
};

interface TreeGlyphProps {
  className?: string;
  title: string;
  children: ReactNode;
}

function TreeGlyph({ className = TREE_ICON_CLASS, title, children }: TreeGlyphProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE.width}
      strokeLinecap={STROKE.linecap}
      strokeLinejoin={STROKE.linejoin}
      className={className}
      aria-hidden
    >
      <title>{title}</title>
      {children}
    </svg>
  );
}

function DocumentGlyph({ className, title }: { className?: string; title: string }) {
  return (
    <TreeGlyph className={className} title={title}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </TreeGlyph>
  );
}

export function TreeChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <TreeGlyph
      className={`${TREE_ICON_CLASS} text-text-muted transition-transform duration-150 ${
        expanded ? "rotate-90" : ""
      }`}
      title={expanded ? "Collapse" : "Expand"}
    >
      <path d="m9 6 6 6-6 6" strokeWidth={2.5} />
    </TreeGlyph>
  );
}

export function TreeFolderIcon() {
  return (
    <TreeGlyph className={`${TREE_ICON_CLASS} text-text-muted`} title="Folder">
      <path d="M4 20h16a1 1 0 0 0 1-1V9H3v10a1 1 0 0 0 1 1z" />
      <path d="M4 9h16V6.5A1.5 1.5 0 0 0 18.5 5H11.7L10 3H4a1 1 0 0 0-1 1v5z" />
    </TreeGlyph>
  );
}

function iconClass(className: string | undefined, tone: string): string {
  return className ?? `${TREE_ICON_CLASS} ${tone}`;
}

export function FileTypeIcon({
  kind,
  fileName,
  className,
}: {
  kind: FileKind;
  fileName: string;
  className?: string;
}) {
  if (kind === "pdf" || isPdfPath(fileName)) {
    return (
      <DocumentGlyph className={iconClass(className, "text-red-400/90")} title="PDF document" />
    );
  }

  if (kind === "tex") {
    return (
      <TreeGlyph className={iconClass(className, "text-text-secondary")} title="LaTeX source">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 12h6M9 16h4" />
      </TreeGlyph>
    );
  }

  if (kind === "bib") {
    return (
      <TreeGlyph className={iconClass(className, "text-text-muted")} title="Bibliography">
        <ellipse cx="12" cy="6" rx="7" ry="2.5" />
        <path d="M5 6v10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
        <path d="M5 11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
      </TreeGlyph>
    );
  }

  if (kind === "style") {
    return (
      <TreeGlyph className={iconClass(className, "text-text-muted")} title="LaTeX class or style">
        <path d="M12 3 3 8l9 5 9-5-9-5z" />
        <path d="M3 13l9 5 9-5" />
        <path d="M3 18l9 5 9-5" />
      </TreeGlyph>
    );
  }

  if (kind === "config") {
    return (
      <TreeGlyph className={iconClass(className, "text-text-muted")} title="Configuration">
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </TreeGlyph>
    );
  }

  return (
    <TreeGlyph className={iconClass(className, "text-text-muted")} title="File">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </TreeGlyph>
  );
}
