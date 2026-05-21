interface PdfFileIconProps {
  className?: string;
}

/** Sidebar / toolbar PDF glyph — red document with folded corner and PDF label. */
export function PdfFileIcon({ className = "h-4 w-4 shrink-0" }: PdfFileIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden>
      <title>PDF Document</title>
      <path fill="#f43f5e" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path fill="#fda4af" d="M14 2v6h6l-6-6z" />
      <rect x="7" y="11" width="10" height="7" rx="1.25" fill="#fafafa" fillOpacity="0.95" />
      <text
        x="12"
        y="16.1"
        textAnchor="middle"
        fontSize="5.25"
        fontWeight="700"
        letterSpacing="0.06em"
        fill="#e11d48"
        fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}
