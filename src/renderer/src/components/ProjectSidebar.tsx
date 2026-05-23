import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ProjectFile, ProjectSnapshot } from "../../../shared/domain";
import { isPdfPath, parentDirectoryPath } from "../../../shared/projectFiles";
import { TREE_LABEL_CLASS, TREE_ROOT_LABEL_CLASS } from "../lib/treeTypography";
import { PdfFileIcon } from "./icons/PdfFileIcon";
import { NewFileDialog } from "./NewFileDialog";

interface ProjectSidebarProps {
  project: ProjectSnapshot | null;
  activePath: string | null;
  onOpenFile(file: ProjectFile): void;
  onCreateFile(parentPath: string, name: string): Promise<void>;
  onRenamePath(path: string, newName: string): Promise<void>;
  onDeletePath(path: string): Promise<void>;
  onError(message: string): void;
}

interface ContextMenuState {
  x: number;
  y: number;
  target: ProjectFile | null;
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
      className="h-3.5 w-3.5 shrink-0 text-text-muted/70"
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

function FileIcon({ kind, fileName }: { kind: string; fileName: string }) {
  if (kind === "pdf" || isPdfPath(fileName)) {
    return <PdfFileIcon className="h-3.5 w-3.5 shrink-0" />;
  }

  if (kind === "tex") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-3.5 w-3.5 shrink-0 text-text-secondary"
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
        className="h-3.5 w-3.5 shrink-0 text-text-muted"
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
        className="h-3.5 w-3.5 shrink-0 text-text-muted"
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
        className="h-3.5 w-3.5 shrink-0 text-text-muted"
      >
        <title>Configuration File</title>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0 text-text-muted"
    >
      <title>Document File</title>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function InlineNameEditor({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  onCommit(value: string): void;
  onCancel(): void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      className={`min-w-0 flex-1 rounded border border-accent/50 bg-zinc-900 px-1 py-0 ${TREE_LABEL_CLASS} text-text-primary outline-none`}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(value.trim())}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          onCommit(value.trim());
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

function FileRow({
  file,
  activePath,
  selectedPath,
  renamingPath,
  onOpenFile,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  expandedPaths,
  onToggleExpand,
  onContextMenu,
}: {
  file: ProjectFile;
  activePath: string | null;
  selectedPath: string | null;
  renamingPath: string | null;
  onOpenFile(file: ProjectFile): void;
  onSelect(file: ProjectFile): void;
  onStartRename(path: string): void;
  onCommitRename(path: string, newName: string): void;
  onCancelRename(): void;
  expandedPaths: Set<string>;
  onToggleExpand(path: string): void;
  onContextMenu(event: MouseEvent, file: ProjectFile): void;
}) {
  const isFolder = file.kind === "folder";
  const isExpanded = expandedPaths.has(file.path);
  const isActive = activePath === file.path;
  const isSelected = selectedPath === file.path;
  const isRenaming = renamingPath === file.path;

  const handleClick = () => {
    onSelect(file);
    if (isFolder) {
      onToggleExpand(file.path);
    } else {
      onOpenFile(file);
    }
  };

  return (
    <li className="list-none">
      <button
        className={`flex w-full items-center gap-1 rounded-sm border-0 bg-transparent px-1 py-0.5 text-left ${TREE_LABEL_CLASS} transition-colors duration-100 ${
          isActive || isSelected
            ? "bg-accent-muted text-text-primary"
            : "text-text-secondary hover:bg-surface-inset hover:text-text-primary"
        }`}
        type="button"
        onClick={handleClick}
        onDoubleClick={(event) => {
          event.preventDefault();
          onStartRename(file.path);
        }}
        onContextMenu={(event) => onContextMenu(event, file)}
      >
        {isFolder ? (
          <>
            <ChevronIcon expanded={isExpanded} />
            <FolderIcon expanded={isExpanded} />
          </>
        ) : (
          <>
            <span className="w-2 shrink-0" />
            <FileIcon kind={file.kind} fileName={file.name} />
          </>
        )}
        {isRenaming ? (
          <InlineNameEditor
            initialValue={file.name}
            onCommit={(newName) => onCommitRename(file.path, newName)}
            onCancel={onCancelRename}
          />
        ) : (
          <span className={`truncate ${TREE_LABEL_CLASS}`}>
            {isFolder ? file.name.toUpperCase() : file.name}
          </span>
        )}
      </button>

      {file.children && isExpanded ? (
        <ul className="relative ml-2 border-l border-border/30 pl-1 my-0.5">
          {file.children.map((child) => (
            <FileRow
              key={child.path}
              file={child}
              activePath={activePath}
              selectedPath={selectedPath}
              renamingPath={renamingPath}
              onOpenFile={onOpenFile}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              onContextMenu={onContextMenu}
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
  onOpenFile,
  onCreateFile,
  onRenamePath,
  onDeletePath,
  onError,
}: ProjectSidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newFileDialog, setNewFileDialog] = useState<{ parentPath: string } | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project) {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
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
    } else {
      setSelectedPath(null);
      setRenamingPath(null);
    }
  }, [project]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const findFile = useCallback(
    (path: string | null): ProjectFile | null => {
      if (!project || !path) return null;
      const walk = (files: ProjectFile[]): ProjectFile | null => {
        for (const file of files) {
          if (file.path === path) return file;
          if (file.children) {
            const match = walk(file.children);
            if (match) return match;
          }
        }
        return null;
      };
      return walk(project.files);
    },
    [project],
  );

  const parentPathForSelection = useCallback((): string => {
    const selected = findFile(selectedPath);
    if (!selected) return "";
    if (selected.kind === "folder") return selected.path;
    return parentDirectoryPath(selected.path);
  }, [findFile, selectedPath]);

  const handleToggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleContextMenu = (event: React.MouseEvent, file: ProjectFile) => {
    event.preventDefault();
    setSelectedPath(file.path);
    setContextMenu({ x: event.clientX, y: event.clientY, target: file });
  };

  const handleWorkspaceContextMenu = (event: React.MouseEvent) => {
    if (!project) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, target: null });
  };

  const startRename = (path: string) => {
    setRenamingPath(path);
    setSelectedPath(path);
    setContextMenu(null);
  };

  const commitRename = async (path: string, newName: string) => {
    setRenamingPath(null);
    if (!newName) return;
    const current = findFile(path);
    if (!current || newName === current.name) return;
    try {
      await onRenamePath(path, newName);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Rename failed");
    }
  };

  const handleDelete = async (path: string) => {
    setContextMenu(null);
    const file = findFile(path);
    if (!file) return;
    const label = file.kind === "folder" ? "folder" : "file";
    if (!window.confirm(`Delete ${label} "${file.name}"?`)) return;
    try {
      await onDeletePath(path);
      setSelectedPath((current) => (current === path ? null : current));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const openNewFileDialog = () => {
    setContextMenu(null);
    setNewFileDialog({ parentPath: parentPathForSelection() });
  };

  const handleCreateNewFile = async (fileName: string) => {
    if (!newFileDialog) return;
    try {
      await onCreateFile(newFileDialog.parentPath, fileName);
      setNewFileDialog(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create file");
      throw error;
    }
  };

  const handleTreeKeyDown = (event: React.KeyboardEvent) => {
    if (!selectedPath || renamingPath) return;
    if (event.key === "F2") {
      event.preventDefault();
      startRename(selectedPath);
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      void handleDelete(selectedPath);
    }
  };

  const contextTarget = contextMenu?.target ?? null;
  const contextPath = contextTarget?.path ?? selectedPath;

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface-raised">
      {project ? (
        <div
          ref={treeRef}
          role="tree"
          tabIndex={0}
          className="flex-1 overflow-y-auto px-1 pb-3 pt-1 outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
          onKeyDown={handleTreeKeyDown}
          onContextMenu={handleWorkspaceContextMenu}
        >
          <ul className="m-0 p-0">
            <li className="list-none">
              <div className="flex w-full items-center gap-1 px-1 py-0.5">
                <span className={`min-w-0 flex-1 truncate ${TREE_ROOT_LABEL_CLASS}`}>
                  {project.name.toUpperCase()}
                </span>
                <button
                  type="button"
                  title="Add new file"
                  className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:text-text-primary cursor-pointer"
                  onClick={openNewFileDialog}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3"
                  >
                    <title>Add new file</title>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </li>
            {project.files.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                activePath={activePath}
                selectedPath={selectedPath}
                renamingPath={renamingPath}
                onOpenFile={onOpenFile}
                onSelect={(entry) => setSelectedPath(entry.path)}
                onStartRename={startRename}
                onCommitRename={(path, newName) => void commitRename(path, newName)}
                onCancelRename={() => setRenamingPath(null)}
                expandedPaths={expandedPaths}
                onToggleExpand={handleToggleExpand}
                onContextMenu={handleContextMenu}
              />
            ))}
          </ul>
        </div>
      ) : (
        <div className="px-4 text-xs leading-relaxed text-text-muted">
          Use <span className="font-medium text-text-secondary">File → Open Folder…</span> in the
          menu bar (⌘O on macOS, Ctrl+O on Windows and Linux).
        </div>
      )}

      {contextMenu ? (
        <div
          role="menu"
          className="fixed z-50 min-w-[11rem] rounded-lg border border-border bg-surface-raised py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-zinc-800/60 hover:text-text-primary"
            onClick={openNewFileDialog}
          >
            New File…
          </button>
          {contextPath ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-zinc-800/60 hover:text-text-primary"
                onClick={() => startRename(contextPath)}
              >
                Rename
                <span className="ml-2 text-text-muted">F2</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-1.5 text-left text-xs text-red-400/90 hover:bg-zinc-800/60"
                onClick={() => void handleDelete(contextPath)}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <NewFileDialog
        open={newFileDialog !== null}
        parentLabel={newFileDialog?.parentPath ?? ""}
        onCancel={() => setNewFileDialog(null)}
        onCreate={handleCreateNewFile}
      />
    </aside>
  );
}
