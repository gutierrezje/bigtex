import { WindowControls } from "./WindowControls";

/** Fullscreen window controls on the welcome screen (no project sidebar). */
export function WelcomeChromeRow() {
  return (
    <div
      className={`flex h-11 shrink-0 items-center border-b border-border/40 bg-surface-raised pl-3 select-none`}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <WindowControls />
      </div>
    </div>
  );
}
