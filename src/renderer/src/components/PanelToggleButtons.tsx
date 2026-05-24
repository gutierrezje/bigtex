import { IconTooltipButton } from "./IconTooltipButton";

interface PanelToggleButtonsProps {
  bottomPanelOpen: boolean;
  onToggleBottomPanel(): void;
  showAgent: boolean;
  onToggleAgent(): void;
}

export function PanelToggleButtons({
  bottomPanelOpen,
  onToggleBottomPanel,
  showAgent,
  onToggleAgent,
}: PanelToggleButtonsProps) {
  const toggleClass = (active: boolean) =>
    `flex items-center justify-center rounded border p-1.5 transition-all duration-200 cursor-pointer ${
      active
        ? "border-transparent bg-surface-raised text-text-primary"
        : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-raised/50"
    }`;

  return (
    <>
      <IconTooltipButton
        hint={bottomPanelOpen ? "Hide bottom panel" : "Show bottom panel"}
        tooltipPlacement="left"
        onClick={onToggleBottomPanel}
        className={toggleClass(bottomPanelOpen)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <title>{bottomPanelOpen ? "Hide bottom panel" : "Show bottom panel"}</title>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <line
            x1="3"
            y1="15"
            x2="21"
            y2="15"
            style={{
              transform: bottomPanelOpen ? "translateY(0px)" : "translateY(6px)",
              opacity: bottomPanelOpen ? 1 : 0,
              transition:
                "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-in-out",
            }}
          />
        </svg>
      </IconTooltipButton>

      <IconTooltipButton
        hint={showAgent ? "Hide assistant" : "Show assistant"}
        tooltipPlacement="left"
        onClick={onToggleAgent}
        className={toggleClass(showAgent)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <title>{showAgent ? "Hide assistant" : "Show assistant"}</title>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <line
            x1="15"
            y1="3"
            x2="15"
            y2="21"
            style={{
              transform: showAgent ? "translateX(0px)" : "translateX(6px)",
              opacity: showAgent ? 1 : 0,
              transition:
                "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-in-out",
            }}
          />
        </svg>
      </IconTooltipButton>
    </>
  );
}
