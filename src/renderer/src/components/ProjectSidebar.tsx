import type { ProjectFile, ProjectSnapshot } from "../../../shared/domain";

interface ProjectSidebarProps {
  project: ProjectSnapshot | null;
  activePath: string | null;
  onOpenProject(): void;
  onOpenSample(): void;
  onOpenFile(file: ProjectFile): void;
}

function FileRow({
  file,
  activePath,
  onOpenFile,
  depth,
}: {
  file: ProjectFile;
  activePath: string | null;
  onOpenFile(file: ProjectFile): void;
  depth: number;
}) {
  const isFolder = file.kind === "folder";
  const isActive = activePath === file.path;

  const dotColor =
    file.kind === "tex"
      ? "bg-accent"
      : file.kind === "bib"
        ? "bg-blue-400"
        : file.kind === "folder"
          ? "bg-amber-400 rounded-sm"
          : "bg-zinc-600";

  return (
    <li>
      <button
        className={`flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-[13px] transition-colors duration-100 ${
          isActive
            ? "bg-accent-muted text-text-primary"
            : "text-text-secondary hover:bg-zinc-800/60 hover:text-text-primary"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        type="button"
        onClick={() => {
          if (!isFolder) onOpenFile(file);
        }}
      >
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <span className="truncate">{file.name}</span>
      </button>
      {file.children ? (
        <ul>
          {file.children.map((child) => (
            <FileRow
              key={child.path}
              file={child}
              activePath={activePath}
              onOpenFile={onOpenFile}
              depth={depth + 1}
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
  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-surface-raised">
      {/* Draggable top region for traffic lights */}
      <div className="h-11 shrink-0" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />

      {/* Brand */}
      <div className="flex min-w-0 items-center gap-3 px-4 pb-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-xs font-bold tracking-tight text-zinc-950">
          TR
        </span>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-text-primary">Tex Ranger</h1>
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
        <ul className="flex-1 overflow-y-auto px-2 pb-4">
          {project.files.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              activePath={activePath}
              onOpenFile={onOpenFile}
              depth={0}
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
