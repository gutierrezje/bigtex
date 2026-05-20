import { describe, expect, it } from "vitest";
import { normalizeAgentLanguage } from "./shiki";

describe("normalizeAgentLanguage", () => {
  it("maps common aliases to supported highlighters", () => {
    expect(normalizeAgentLanguage("tex")).toBe("latex");
    expect(normalizeAgentLanguage("patch")).toBe("diff");
    expect(normalizeAgentLanguage("ts")).toBe("typescript");
  });

  it("falls back to text for unknown languages", () => {
    expect(normalizeAgentLanguage("fortran")).toBe("text");
  });
});
