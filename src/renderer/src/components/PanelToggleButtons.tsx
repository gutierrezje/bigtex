interface PanelToggleButtonsProps {
  showOutput: boolean;
  onToggleOutput(): void;
  showAgent: boolean;
  onToggleAgent(): void;
}

export function PanelToggleButtons({
  showOutput,
  onToggleOutput,
  showAgent,
  onToggleAgent,
}: PanelToggleButtonsProps) {
  const toggleClass = (active: boolean) =>
    `rounded border p-1.5 transition-all duration-200 cursor-pointer ${
      active
        ? "border-transparent bg-surface-raised text-text-primary"
        : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-raised/50"
    }`;

  return (
    <>
      <button
        type="button"
        title="Toggle Output Panel"
        className={toggleClass(showOutput)}
        onClick={onToggleOutput}
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
        >
          <title>Toggle Output Panel</title>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <line
            x1="3"
            y1="15"
            x2="21"
            y2="15"
            style={{
              transform: showOutput ? "translateY(0px)" : "translateY(6px)",
              opacity: showOutput ? 1 : 0,
              transition:
                "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-in-out",
            }}
          />
        </svg>
      </button>

      <button
        type="button"
        title="Toggle AI Agent Panel"
        className={toggleClass(showAgent)}
        onClick={onToggleAgent}
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
        >
          <title>Toggle AI Agent</title>
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
      </button>
    </>
  );
}
