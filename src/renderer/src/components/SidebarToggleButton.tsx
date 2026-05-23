interface SidebarToggleButtonProps {
  active?: boolean;
  title?: string;
  onClick(): void;
}

export function SidebarToggleButton({
  active = false,
  title = "Toggle Sidebar (Files)",
  onClick,
}: SidebarToggleButtonProps) {
  return (
    <button
      type="button"
      title={title}
      className={`rounded border p-1.5 transition-all duration-200 cursor-pointer ${
        active
          ? "border-transparent bg-surface-raised text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-raised/50"
      }`}
      onClick={onClick}
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
        <title>Toggle Sidebar</title>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <line
          x1="9"
          y1="3"
          x2="9"
          y2="21"
          style={{
            transform: active ? "translateX(0px)" : "translateX(-6px)",
            opacity: active ? 1 : 0,
            transition: "transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-in-out",
          }}
        />
      </svg>
    </button>
  );
}
