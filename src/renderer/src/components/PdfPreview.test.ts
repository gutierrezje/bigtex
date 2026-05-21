import { describe, expect, it } from "vitest";
import { pdfFitScale, pdfFitScaleCapped } from "./PdfPreview";

describe("pdfFitScale", () => {
  it("scales down uniformly to fit a landscape page in a portrait pane", () => {
    const scale = pdfFitScale(1000, 500, 400, 800);
    expect(scale).toBe(0.4);
  });

  it("scales down uniformly to fit a portrait page in a landscape pane", () => {
    const scale = pdfFitScale(500, 1000, 800, 400);
    expect(scale).toBe(0.4);
  });

  it("uses the limiting dimension so aspect ratio is preserved", () => {
    const scale = pdfFitScale(200, 100, 100, 100);
    expect(scale).toBe(0.5);
  });
});

describe("pdfFitScaleCapped", () => {
  it("reduces scale when the fitted canvas would exceed the pixel budget", () => {
    const scale = pdfFitScaleCapped(1000, 1000, 2000, 2000, 1_000_000);
    expect(scale).toBe(1);
    expect(1000 * scale * 1000 * scale).toBeLessThanOrEqual(1_000_000);
  });
});
