import { FileTypeIcon } from "./projectTreeIcons";

interface PdfFileIconProps {
  className?: string;
}

/** PDF tree glyph — reuses unified stroke icon set. */
export function PdfFileIcon({ className }: PdfFileIconProps) {
  return <FileTypeIcon kind="pdf" fileName="document.pdf" className={className} />;
}
