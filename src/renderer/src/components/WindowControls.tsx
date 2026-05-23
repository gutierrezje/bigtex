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
        aria-label="Close"
        className={`${controlBase} bg-[#ff5f57]`}
        onClick={() => void window.bigTex.window.close()}
      />
      <button
        type="button"
        aria-label="Minimize"
        className={`${controlBase} bg-[#febc2e]`}
        onClick={() => void window.bigTex.window.minimize()}
      />
      <button
        type="button"
        aria-label="Toggle fullscreen"
        className={`${controlBase} bg-[#28c840]`}
        onClick={() => void window.bigTex.window.toggleFullscreen()}
      />
    </div>
  );
}
