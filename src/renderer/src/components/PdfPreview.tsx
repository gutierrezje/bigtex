import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import type { PdfPayload } from "../../../shared/domain";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RESIZE_DEBOUNCE_MS = 120;
/** Keep canvas bitmaps bounded during large-pane resizes. */
const MAX_CANVAS_PIXELS = 4_000_000;
const MAX_OUTPUT_SCALE = 2;

interface PdfPreviewProps {
  pdf: PdfPayload | null;
}

interface ViewportSize {
  width: number;
  height: number;
}

/** Scale so the page fits inside the container without changing aspect ratio. */
export function pdfFitScale(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
): number {
  if (pageWidth <= 0 || pageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return 1;
  }
  return Math.min(containerWidth / pageWidth, containerHeight / pageHeight);
}

export function pdfFitScaleCapped(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  maxPixels = MAX_CANVAS_PIXELS,
): number {
  let scale = pdfFitScale(pageWidth, pageHeight, containerWidth, containerHeight);
  const pixels = pageWidth * scale * pageHeight * scale;
  if (pixels > maxPixels) {
    scale *= Math.sqrt(maxPixels / pixels);
  }
  return scale;
}

function isRenderingCancelled(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "RenderingCancelledException" || error.message.includes("cancelled"))
  );
}

export function PdfPreview({ pdf }: PdfPreviewProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const renderEpochRef = useRef(0);
  const viewportSizeRef = useRef<ViewportSize>({ width: 0, height: 0 });
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageNumberRef = useRef(1);
  const scheduleRenderRef = useRef<(() => void) | null>(null);

  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  pageNumberRef.current = pageNumber;

  useEffect(() => {
    setPageNumber(1);
    setPageCount(0);
    setError(null);
  }, [pdf?.loadedAt, pdf?.path]);

  useEffect(() => {
    let disposed = false;

    function cancelRenderTask(): void {
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    }

    async function loadDocument(): Promise<void> {
      cancelRenderTask();
      documentRef.current?.destroy();
      documentRef.current = null;
      setPageCount(0);

      if (!pdf) return;

      try {
        const doc = await pdfjs.getDocument({ data: pdf.data }).promise;
        if (disposed) {
          void doc.destroy();
          return;
        }
        documentRef.current = doc;
        setPageCount(doc.numPages);
        scheduleRenderRef.current?.();
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load PDF.");
        }
      }
    }

    void loadDocument();

    return () => {
      disposed = true;
      cancelRenderTask();
      documentRef.current?.destroy();
      documentRef.current = null;
    };
  }, [pdf?.loadedAt, pdf?.path, pdf]);

  useEffect(() => {
    let disposed = false;

    function cancelRenderTask(): void {
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    }

    function clearResizeTimer(): void {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
    }

    async function renderPage(): Promise<void> {
      const epoch = ++renderEpochRef.current;
      cancelRenderTask();

      const doc = documentRef.current;
      const canvas = canvasRef.current;
      const { width, height } = viewportSizeRef.current;
      if (!doc || !canvas || width <= 0 || height <= 0) return;

      try {
        const page = await doc.getPage(Math.min(pageNumberRef.current, doc.numPages));
        if (disposed || epoch !== renderEpochRef.current) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = pdfFitScaleCapped(baseViewport.width, baseViewport.height, width, height);
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context) return;

        const outputScale = Math.min(window.devicePixelRatio || 1, MAX_OUTPUT_SCALE);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const task = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform,
        });
        renderTaskRef.current = task;
        await task.promise;

        if (disposed || epoch !== renderEpochRef.current) return;
        setError(null);
      } catch (renderError) {
        if (disposed || epoch !== renderEpochRef.current || isRenderingCancelled(renderError)) {
          return;
        }
        setError(renderError instanceof Error ? renderError.message : "Unable to render PDF.");
      } finally {
        if (renderTaskRef.current && epoch === renderEpochRef.current) {
          renderTaskRef.current = null;
        }
      }
    }

    function scheduleRender(): void {
      clearResizeTimer();
      resizeTimerRef.current = setTimeout(() => {
        resizeTimerRef.current = null;
        void renderPage();
      }, RESIZE_DEBOUNCE_MS);
    }

    function scheduleRenderSoon(): void {
      clearResizeTimer();
      void renderPage();
    }

    const element = viewportRef.current;
    const observer =
      element && pdf
        ? new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (!rect) return;

            const next = {
              width: Math.floor(rect.width),
              height: Math.floor(rect.height),
            };
            const prev = viewportSizeRef.current;
            if (prev.width === next.width && prev.height === next.height) return;

            viewportSizeRef.current = next;
            scheduleRender();
          })
        : null;

    if (observer && element) observer.observe(element);

    scheduleRenderRef.current = scheduleRenderSoon;
    scheduleRenderSoon();

    return () => {
      disposed = true;
      scheduleRenderRef.current = null;
      observer?.disconnect();
      clearResizeTimer();
      cancelRenderTask();
    };
  }, [pdf?.loadedAt, pdf?.path, pdf, pageNumber]);

  if (!pdf) {
    return (
      <div
        ref={viewportRef}
        className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-surface-raised px-4"
      >
        <p className="max-w-sm text-center text-sm leading-relaxed text-text-secondary">
          Compile or open a PDF from the project tree.
        </p>
        {error ? <p className="mt-2 text-center text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-surface-raised">
      <div
        ref={viewportRef}
        className="flex min-h-0 h-full w-full items-center justify-center overflow-hidden"
      >
        <canvas ref={canvasRef} className="pdf-canvas block shrink-0" />
        {error ? <p className="px-2 py-1 text-center text-sm text-danger">{error}</p> : null}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/40 px-2 py-1">
        <span className="text-xs font-medium text-text-muted">
          Page {pageNumber} of {pageCount || "?"}
        </span>
        <div className="flex gap-0.5">
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-xs font-medium text-text-muted transition-colors duration-100 hover:bg-background/60 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-xs font-medium text-text-muted transition-colors duration-100 hover:bg-background/60 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={pageCount > 0 && pageNumber >= pageCount}
            onClick={() => setPageNumber((p) => Math.min(pageCount || p + 1, p + 1))}
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}
