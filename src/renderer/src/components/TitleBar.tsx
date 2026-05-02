/**
 * Draggable title-bar region for the frameless window.
 * On macOS with `titleBarStyle: 'hiddenInset'`, this provides the
 * drag handle area while the native traffic lights remain visible.
 */
export function TitleBar() {
  return (
    <div
      className="h-11 shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    />
  );
}
