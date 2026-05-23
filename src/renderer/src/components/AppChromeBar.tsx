import { CHROME_TITLE_CLASS } from "../lib/treeTypography";
import { formatWindowChromeLabel } from "../lib/windowChrome";
import { PanelToggleButtons } from "./PanelToggleButtons";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { WindowControls } from "./WindowControls";

/** Native traffic-light inset (`trafficLightPosition` x: 16 + ~52px buttons). */
export const NATIVE_TRAFFIC_LIGHT_GUTTER = "pl-[4.75rem]";

const chromeRowClass =
  "flex h-11 shrink-0 items-center gap-2 border-b border-border/40 bg-surface-raised pr-3 select-none";

interface AppChromeBarProps {
  projectName: string;
  filePath: string | null;
  sidebarOpen: boolean;
  showWindowControls: boolean;
  onToggleSidebar(): void;
  bottomPanelOpen: boolean;
  onToggleBottomPanel(): void;
  showAgent: boolean;
  onToggleAgent(): void;
}

/**
 * Single top chrome for the editor shell. Stays fixed while the file sidebar
 * collapses so traffic lights, toggles, and panel controls do not jump.
 */
export function AppChromeBar({
  projectName,
  filePath,
  sidebarOpen,
  showWindowControls,
  onToggleSidebar,
  bottomPanelOpen,
  onToggleBottomPanel,
  showAgent,
  onToggleAgent,
}: AppChromeBarProps) {
  const label = formatWindowChromeLabel(projectName, filePath);
  const showWorkspaceLabel = !sidebarOpen || filePath != null;

  return (
    <div
      className={`relative ${chromeRowClass} ${showWindowControls ? "pl-3" : NATIVE_TRAFFIC_LIGHT_GUTTER}`}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="relative z-10 flex shrink-0 items-center gap-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {showWindowControls ? <WindowControls /> : null}
        <SidebarToggleButton
          active={sidebarOpen}
          title={sidebarOpen ? "Collapse Sidebar (Files)" : "Open Sidebar (Files)"}
          onClick={onToggleSidebar}
        />
      </div>

      {showWorkspaceLabel ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-36">
          <span
            className={`max-w-full truncate text-center text-text-secondary ${CHROME_TITLE_CLASS}`}
          >
            {label}
          </span>
        </div>
      ) : null}

      <div
        className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <PanelToggleButtons
          bottomPanelOpen={bottomPanelOpen}
          onToggleBottomPanel={onToggleBottomPanel}
          showAgent={showAgent}
          onToggleAgent={onToggleAgent}
        />
      </div>
    </div>
  );
}
