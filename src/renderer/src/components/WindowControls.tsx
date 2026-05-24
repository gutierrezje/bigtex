const controlBase =
  "h-3 w-3 shrink-0 rounded-full border border-black/15 transition-[filter] hover:brightness-110 active:brightness-95";

export function WindowControls() {
  return (
    <div
      className="flex shrink-0 items-center gap-2"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        type="button"
        aria-label="Close window"
        onClick={() => void window.bigTex.window.close()}
        className={controlBase}
        style={{ backgroundColor: "#ff5f57" }}
      />
      <button
        type="button"
        aria-label="Minimize window"
        onClick={() => void window.bigTex.window.minimize()}
        className={controlBase}
        style={{ backgroundColor: "#febc2e" }}
      />
      <button
        type="button"
        aria-label="Toggle fullscreen"
        onClick={() => void window.bigTex.window.toggleFullscreen()}
        className={controlBase}
        style={{ backgroundColor: "#28c840" }}
      />
    </div>
  );
}
