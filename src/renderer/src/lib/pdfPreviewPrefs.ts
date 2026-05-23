const PDF_PREVIEW_INVERT_KEY = "bigtex.pdfPreviewInvert";

/** Default on — matches dark workbench canvas. */
export function readPdfPreviewInvert(): boolean {
  try {
    const stored = localStorage.getItem(PDF_PREVIEW_INVERT_KEY);
    if (stored === "false") return false;
    if (stored === "true") return true;
  } catch {
    /* private mode / blocked storage */
  }
  return true;
}

export function writePdfPreviewInvert(inverted: boolean): void {
  try {
    localStorage.setItem(PDF_PREVIEW_INVERT_KEY, inverted ? "true" : "false");
  } catch {
    /* ignore */
  }
}
