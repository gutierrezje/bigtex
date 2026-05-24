/** Mini page glyph: dark paper + light lines when inverted, light paper + dark lines otherwise. */
export function PdfInvertIcon({ inverted }: { inverted: boolean }) {
  const paperFill = inverted ? "#09090b" : "#f4f4f6";
  const lineStroke = inverted ? "#f4f4f6" : "#18181b";
  const frameStroke = inverted ? "#3f3f46" : "#a1a1aa";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="block h-4 w-4"
      aria-hidden
    >
      <title>{inverted ? "Original" : "Invert"}</title>
      <rect
        x="5"
        y="3.5"
        width="14"
        height="17"
        rx="2"
        fill={paperFill}
        stroke={frameStroke}
        strokeWidth="1"
      />
      <line
        x1="8"
        y1="8"
        x2="15"
        y2="8"
        stroke={lineStroke}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="11"
        x2="16"
        y2="11"
        stroke={lineStroke}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="14"
        x2="13.5"
        y2="14"
        stroke={lineStroke}
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="17"
        x2="11"
        y2="17"
        stroke={lineStroke}
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}
