import { describe, expect, it } from "vitest";
import { BLANK_MAIN_TEX, BLANK_PROJECT_FILES, BLANK_REFERENCES_BIB } from "./projectScaffold";

describe("projectScaffold", () => {
  it("includes main.tex and references.bib", () => {
    expect(BLANK_PROJECT_FILES.map((f) => f.name)).toEqual(["main.tex", "references.bib"]);
    expect(BLANK_MAIN_TEX).toContain("\\documentclass");
    expect(BLANK_REFERENCES_BIB.length).toBeGreaterThan(0);
  });
});
