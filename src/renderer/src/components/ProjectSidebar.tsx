import { useEffect, useState } from "react";
import type { ProjectFile, ProjectSnapshot } from "../../../shared/domain";

interface ProjectSidebarProps {
  project: ProjectSnapshot | null;
  activePath: string | null;
  onOpenProject(): void;
  onOpenSample(): void;
  onOpenFile(file: ProjectFile): void;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3 w-3 shrink-0 text-text-muted transition-transform duration-150 ${
        expanded ? "rotate-90" : ""
      }`}
    >
      <title>{expanded ? "Collapse" : "Expand"}</title>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FolderIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4 shrink-0 text-amber-500/80"
    >
      <title>{expanded ? "Expanded Folder" : "Collapsed Folder"}</title>
      {expanded ? (
        <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a3 3 0 0 1 2.122.879l1.621 1.622a1.5 1.5 0 0 0 1.061.44H19.5a3 3 0 0 1 3 3v1.205a4.498 4.498 0 0 0-3-1.205h-15a4.5 4.5 0 0 0-3 1.205Z" />
      ) : (
        <path d="M19.5 21a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-5.379a1.5 1.5 0 0 1-1.06-.44L11.44 3.938A3 3 0 0 0 9.318 3H4.5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15Z" />
      )}
    </svg>
  );
}

function FileIcon({ kind }: { kind: string }) {
  if (kind === "tex") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-4 w-4 shrink-0 text-teal-400"
      >
        <title>LaTeX Source File</title>
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
        <path d="M9 7h4v1.5h-2.5v1.5h2v1.5h-2v2h2.5V15H9V7z" />
      </svg>
    );
  }

  if (kind === "bib") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-sky-400"
      >
        <title>Bibliography Database File</title>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
      </svg>
    );
  }

  if (kind === "style") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-violet-400"
      >
        <title>Style or Class File</title>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    );
  }

  if (kind === "config") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0 text-zinc-400"
      >
        <title>Configuration File</title>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }

  // Default document icon
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-zinc-400"
    >
      <title>Document File</title>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function FileRow({
  file,
  activePath,
  onOpenFile,
  expandedPaths,
  onToggleExpand,
}: {
  file: ProjectFile;
  activePath: string | null;
  onOpenFile(file: ProjectFile): void;
  expandedPaths: Set<string>;
  onToggleExpand(path: string): void;
}) {
  const isFolder = file.kind === "folder";
  const isExpanded = expandedPaths.has(file.path);
  const isActive = activePath === file.path;

  const handleClick = () => {
    if (isFolder) {
      onToggleExpand(file.path);
    } else {
      onOpenFile(file);
    }
  };

  return (
    <li className="list-none">
      <button
        className={`flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1 text-left text-[13px] transition-colors duration-100 ${
          isActive
            ? "bg-accent-muted text-text-primary font-medium"
            : "text-text-secondary hover:bg-zinc-800/40 hover:text-text-primary"
        }`}
        type="button"
        onClick={handleClick}
      >
        {isFolder ? (
          <>
            <ChevronIcon expanded={isExpanded} />
            <FolderIcon expanded={isExpanded} />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <FileIcon kind={file.kind} />
          </>
        )}
        <span className="truncate">{file.name}</span>
      </button>

      {file.children && isExpanded ? (
        <ul className="relative ml-[13px] border-l border-border/30 pl-1.5 my-0.5">
          {file.children.map((child) => (
            <FileRow
              key={child.path}
              file={child}
              activePath={activePath}
              onOpenFile={onOpenFile}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ProjectSidebar({
  project,
  activePath,
  onOpenProject,
  onOpenSample,
  onOpenFile,
}: ProjectSidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (project) {
      for (const f of project.files) {
        if (f.kind === "folder") {
          initial.add(f.path);
        }
      }
    }
    return initial;
  });

  useEffect(() => {
    if (project) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        // Helper to recursively auto-expand directories on first load
        const expandRecursive = (files: ProjectFile[]) => {
          for (const f of files) {
            if (f.kind === "folder") {
              next.add(f.path);
              if (f.children) expandRecursive(f.children);
            }
          }
        };
        expandRecursive(project.files);
        return next;
      });
    }
  }, [project]);

  const handleToggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-surface-raised">
      {/* Brand */}
      <div className="flex min-w-0 items-center gap-3 px-4 pt-4 pb-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-xs font-bold tracking-tight text-zinc-950 shadow-sm transition-transform hover:scale-102">
          BT
        </span>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-text-primary">BigTex</h1>
          <p className="text-[11px] text-text-muted">Agentic LaTeX editor</p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-1.5 px-4 pb-4 xl:grid-cols-2">
        <button
          type="button"
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-100 hover:border-accent/40 hover:text-text-primary"
          onClick={onOpenProject}
        >
          Open Project
        </button>
        <button
          type="button"
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-100 hover:border-accent/40 hover:text-text-primary"
          onClick={onOpenSample}
        >
          Sample
        </button>
      </div>

      {/* Workspace label */}
      <div className="px-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Workspace
        </span>
        <strong className="mt-0.5 block truncate text-sm font-medium text-text-primary">
          {project?.name ?? "No project"}
        </strong>
      </div>

      {/* File tree */}
      {project ? (
        <ul className="flex-1 overflow-y-auto px-2 pb-4 my-0">
          {project.files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              activePath={activePath}
              onOpenFile={onOpenFile}
              expandedPaths={expandedPaths}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </ul>
      ) : (
        <div className="px-4 text-xs leading-relaxed text-text-muted">
          Open a folder with a <code className="font-mono text-text-secondary">.tex</code> file, or
          load the bundled sample to explore the MVP.
        </div>
      )}
    </aside>
  );
}
