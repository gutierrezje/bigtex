import { formatWindowChromeLabel } from "../lib/windowChrome";

interface TitleBarProps {
  projectName: string | null;
  filePath: string | null;
}

/**
 * Workspace title beside the traffic lights (`titleBarStyle: hiddenInset`).
 * Stays in the drag region so the window can be moved from this strip.
 */
export function TitleBar({ projectName, filePath }: TitleBarProps) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center overflow-hidden pl-20 pr-3"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="truncate text-[13px] font-medium text-text-muted">
        {formatWindowChromeLabel(projectName, filePath)}
      </span>
    </div>
  );
}
