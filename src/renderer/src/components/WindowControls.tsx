import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const TRAFFIC_LIGHT_SIZE = "h-3.5 w-3.5";
const TRAFFIC_ICON_PX = 10;
/** Green zoom glyphs need more canvas — corner brackets are visually smaller than × / −. */
const TRAFFIC_FULLSCREEN_ICON_PX = 11;

const controlBase = `relative ${TRAFFIC_LIGHT_SIZE} shrink-0 rounded-full border border-black/15 transition-[filter] hover:brightness-110 active:brightness-95`;

const controlDisabled = `relative ${TRAFFIC_LIGHT_SIZE} shrink-0 cursor-default rounded-full border border-black/10 bg-[#5a5a5a] opacity-90`;

const iconWrapClass =
  "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-75 group-hover/traffic:opacity-100";

const iconStroke = "currentColor";

function useWindowFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.bigTex.window.isFullscreen().then((value) => {
      if (!cancelled) setIsFullscreen(value);
    });
    const unsubscribe = window.bigTex.window.onFullscreenChanged((value) => {
      if (!cancelled) setIsFullscreen(value);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return isFullscreen;
}

function CloseGlyph() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; parent button has aria-label
    <svg
      width={TRAFFIC_ICON_PX}
      height={TRAFFIC_ICON_PX}
      viewBox="0 0 8 8"
      fill="none"
      aria-hidden
      className="text-[#4a0002]"
    >
      <path
        d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5"
        stroke={iconStroke}
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MinimizeGlyph() {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; parent button has aria-label
    <svg
      width={TRAFFIC_ICON_PX}
      height={TRAFFIC_ICON_PX}
      viewBox="0 0 8 8"
      fill="none"
      aria-hidden
      className="text-[#5a4a00]"
    >
      <path d="M1.75 4h4.5" stroke={iconStroke} strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

/** macOS green-button zoom — outward triangles; flipped inward when in fullscreen. */
function FullscreenGlyph({ exiting }: { exiting: boolean }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; parent button has aria-label
    <svg
      width={TRAFFIC_FULLSCREEN_ICON_PX}
      height={TRAFFIC_FULLSCREEN_ICON_PX}
      viewBox="0 0 8 8"
      fill="currentColor"
      aria-hidden
      className="origin-center text-[#0a4a12]"
    >
      {exiting ? (
        <path d="M0.0 3.8h3.8V0.0L0.0 3.8z M8.0 4.2H4.2v3.8L8.0 4.2z" />
      ) : (
        <path d="M1.0 4.8V1.0h3.8L1.0 4.8z M7.0 3.2v3.8H3.2L7.0 3.2z" />
      )}
    </svg>
  );
}

function TrafficLightIcon({
  children,
  showOnHover = true,
  alwaysVisible = false,
}: {
  children: ReactNode;
  showOnHover?: boolean;
  alwaysVisible?: boolean;
}) {
  const className = alwaysVisible
    ? "pointer-events-none absolute inset-0 flex items-center justify-center opacity-100"
    : showOnHover
      ? iconWrapClass
      : "pointer-events-none absolute inset-0 flex items-center justify-center opacity-0";
  return <span className={className}>{children}</span>;
}

export function WindowControls() {
  const isFullscreen = useWindowFullscreen();

  return (
    <div
      className="group/traffic flex shrink-0 items-center gap-2.5"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <button
        type="button"
        aria-label="Close window"
        onClick={() => void window.bigTex.window.close()}
        className={controlBase}
        style={{ backgroundColor: "#ff5f57" }}
      >
        <TrafficLightIcon>
          <CloseGlyph />
        </TrafficLightIcon>
      </button>
      <button
        type="button"
        aria-label={isFullscreen ? "Minimize unavailable in fullscreen" : "Minimize window"}
        disabled={isFullscreen}
        onClick={() => {
          if (!isFullscreen) void window.bigTex.window.minimize();
        }}
        className={isFullscreen ? controlDisabled : controlBase}
        style={isFullscreen ? undefined : { backgroundColor: "#febc2e" }}
      >
        <TrafficLightIcon showOnHover={!isFullscreen}>
          <MinimizeGlyph />
        </TrafficLightIcon>
      </button>
      <button
        type="button"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        onClick={() => void window.bigTex.window.toggleFullscreen()}
        className={controlBase}
        style={{ backgroundColor: "#28c840" }}
      >
        <TrafficLightIcon>
          <FullscreenGlyph exiting={isFullscreen} />
        </TrafficLightIcon>
      </button>
    </div>
  );
}
