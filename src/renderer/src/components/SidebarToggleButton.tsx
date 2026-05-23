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
      className={`rounded border p-1.5 transition-all duration-100 cursor-pointer ${
        active
          ? "border-accent/20 bg-accent/8 text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
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
        <path d="M9 3v18" />
      </svg>
    </button>
  );
}
