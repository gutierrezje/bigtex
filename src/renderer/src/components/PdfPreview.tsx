import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import type { PdfPayload } from "../../../shared/domain";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPreviewProps {
  pdf: PdfPayload | null;
}

export function PdfPreview({ pdf }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf(): Promise<void> {
      if (!pdf || !canvasRef.current) return;
      setError(null);

      try {
        const document = await pdfjs.getDocument({ data: pdf.data.slice() }).promise;
        if (cancelled) return;

        setPageCount(document.numPages);
        const page = await document.getPage(Math.min(pageNumber, document.numPages));
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Unable to render PDF.");
        }
      }
    }

    void renderPdf();

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  return (
    <section className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface-raised">
      <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Preview
          </span>
          <h2 className="mt-0.5 text-sm font-medium">
            {pdf ? `Page ${pageNumber} of ${pageCount || "?"}` : "No PDF"}
          </h2>
        </div>
        <div className="flex gap-0.5 rounded-md bg-zinc-900 p-0.5">
          <button
            type="button"
            className="rounded-[5px] border-0 bg-transparent px-2.5 py-1 text-xs font-medium text-text-muted transition-colors duration-100 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!pdf || pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-[5px] border-0 bg-transparent px-2.5 py-1 text-xs font-medium text-text-muted transition-colors duration-100 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!pdf || (pageCount > 0 && pageNumber >= pageCount)}
            onClick={() => setPageNumber((p) => Math.min(pageCount || p + 1, p + 1))}
          >
            Next
          </button>
        </div>
      </header>

      <div
        className="grid place-items-start overflow-auto bg-surface-inset p-4"
        style={{ justifyItems: "center" }}
      >
        {pdf ? (
          <canvas ref={canvasRef} className="pdf-canvas" />
        ) : (
          <p className="text-sm text-text-muted">Compile to load a PDF.</p>
        )}
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>
    </section>
  );
}
