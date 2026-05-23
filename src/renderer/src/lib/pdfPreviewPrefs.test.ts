import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readPdfPreviewInvert, writePdfPreviewInvert } from "./pdfPreviewPrefs";

describe("pdfPreviewPrefs", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to inverted preview", () => {
    expect(readPdfPreviewInvert()).toBe(true);
  });

  it("persists invert preference", () => {
    writePdfPreviewInvert(false);
    expect(readPdfPreviewInvert()).toBe(false);
    writePdfPreviewInvert(true);
    expect(readPdfPreviewInvert()).toBe(true);
  });
});
