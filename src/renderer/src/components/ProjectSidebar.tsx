import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import type { ProjectFile, ProjectSnapshot } from "../../../shared/domain";
import { ancestorFolderPaths, parentDirectoryPath } from "../../../shared/projectFiles";
import { TREE_LABEL_CLASS } from "../lib/treeTypography";
import { FileTypeIcon, TreeChevronIcon, TreeFolderIcon } from "./icons/projectTreeIcons";
import { NewFileDialog } from "./NewFileDialog";
import { ProjectSidebarHeader } from "./ProjectSidebarHeader";

interface ProjectSidebarProps {
  project: ProjectSnapshot | null;
  activePath: string | null;
  onOpenFile(file: ProjectFile): void;
  onCreateFile(parentPath: string, name: string): Promise<void>;
  onRenamePath(path: string, newName: string): Promise<void>;
  onDeletePath(path: string): Promise<void>;
  onRefresh(): void | Promise<void>;
  onError(message: string): void;
}

interface ContextMenuState {
  x: number;
  y: number;
  target: ProjectFile | null;
}

function treeRowButtonClass(isActive: boolean, isSelected: boolean): string {
  const state = isActive
    ? "tree-row--active"
    : isSelected
      ? "tree-row--selected"
      : "text-text-secondary";
  return `tree-row ${TREE_LABEL_CLASS} ${state}`;
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
      className={`min-w-0 flex-1 rounded-sm border border-accent/50 bg-zinc-900 px-1 py-0 text-[13px] leading-[22px] text-text-primary outline-none`}
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
  depth,
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
  depth: number;
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
        className={treeRowButtonClass(isActive, isSelected)}
        type="button"
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-level={depth + 1}
        data-tree-path={file.path}
        onClick={handleClick}
        onDoubleClick={(event) => {
          event.preventDefault();
          onStartRename(file.path);
        }}
        onContextMenu={(event) => onContextMenu(event, file)}
      >
        <span className="tree-row-chevron" aria-hidden={!isFolder}>
          {isFolder ? <TreeChevronIcon expanded={isExpanded} /> : null}
        </span>
        <span className="tree-row-icon" aria-hidden={isFolder}>
          {isFolder ? <TreeFolderIcon /> : <FileTypeIcon kind={file.kind} fileName={file.name} />}
        </span>
        {isRenaming ? (
          <InlineNameEditor
            initialValue={file.name}
            onCommit={(newName) => onCommitRename(file.path, newName)}
            onCancel={onCancelRename}
          />
        ) : (
          <span className="tree-row-label">{file.name}</span>
        )}
      </button>

      {file.children && isExpanded ? (
        <ul className="tree-children">
          {file.children.map((child) => (
            <FileRow
              key={child.path}
              file={child}
              depth={depth + 1}
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
  onRefresh,
  onError,
}: ProjectSidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [newFileDialog, setNewFileDialog] = useState<{ parentPath: string } | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const projectRoot = project?.rootPath ?? null;
  const previousProjectRootRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectRoot) {
      previousProjectRootRef.current = null;
      setExpandedPaths(new Set());
      setSelectedPath(null);
      setRenamingPath(null);
      return;
    }
    if (previousProjectRootRef.current === projectRoot) return;
    previousProjectRootRef.current = projectRoot;
    setExpandedPaths(activePath ? new Set(ancestorFolderPaths(activePath)) : new Set());
  }, [projectRoot, activePath]);

  useEffect(() => {
    if (!project || !activePath) return;
    setExpandedPaths((prev) => {
      const required = ancestorFolderPaths(activePath);
      if (required.every((folder) => prev.has(folder))) return prev;
      const next = new Set(prev);
      for (const folder of required) next.add(folder);
      return next;
    });
  }, [project, activePath]);

  useEffect(() => {
    if (!activePath) return;
    const frame = requestAnimationFrame(() => {
      const row = treeRef.current?.querySelector<HTMLElement>(
        `[data-tree-path="${CSS.escape(activePath)}"]`,
      );
      row?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activePath, expandedPaths]);

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

  const collapseAllFolders = () => {
    setExpandedPaths(new Set());
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
        <>
          <ProjectSidebarHeader
            projectName={project.name}
            onNewFile={openNewFileDialog}
            onCollapseAll={collapseAllFolders}
            onRefresh={() => void onRefresh()}
          />
          <div
            ref={treeRef}
            role="tree"
            tabIndex={0}
            className="flex-1 overflow-y-auto px-0 pb-3 pt-1 outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
            onKeyDown={handleTreeKeyDown}
            onContextMenu={handleWorkspaceContextMenu}
          >
            <ul className="m-0 p-0">
              {project.files.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  depth={0}
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
        </>
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
