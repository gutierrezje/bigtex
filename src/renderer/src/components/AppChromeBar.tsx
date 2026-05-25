import { CHROME_TITLE_CLASS } from "../lib/treeTypography";
import { formatWindowChromeLabel } from "../lib/windowChrome";
import { IconTooltipButton } from "./IconTooltipButton";
import { SettingsIcon } from "./icons/SettingsIcon";
import { PanelToggleButtons } from "./PanelToggleButtons";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { WindowControls } from "./WindowControls";

/** Native traffic-light inset (`trafficLightPosition` x: 16 + ~52px buttons). */
export const NATIVE_TRAFFIC_LIGHT_GUTTER = "pl-[4.75rem]";

const chromeRowClass =
  "relative z-30 flex h-11 shrink-0 items-center gap-2 overflow-visible border-b border-border/40 bg-surface-raised pr-3 select-none";

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
  onOpenSettings(): void;
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
  onOpenSettings,
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
          alignWithNativeTrafficLights={!showWindowControls}
          title={sidebarOpen ? "Hide explorer" : "Show explorer"}
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
        <IconTooltipButton
          hint="Settings (⌘,)"
          tooltipPlacement="left"
          aria-label="Settings"
          onClick={onOpenSettings}
          className="flex items-center justify-center rounded border border-transparent p-1.5 text-text-muted transition-all duration-200 hover:bg-surface-raised/50 hover:text-text-secondary cursor-pointer"
        >
          <SettingsIcon />
        </IconTooltipButton>
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
