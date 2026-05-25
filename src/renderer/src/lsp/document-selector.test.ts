import { describe, expect, it } from "vitest";
import { matchesTexlabDocumentPath } from "./document-selector";

describe("matchesTexlabDocumentPath", () => {
  it("includes LaTeX and BibTeX source extensions", () => {
    expect(matchesTexlabDocumentPath("main.tex")).toBe(true);
    expect(matchesTexlabDocumentPath("macros.sty")).toBe(true);
    expect(matchesTexlabDocumentPath("class.cls")).toBe(true);
    expect(matchesTexlabDocumentPath("refs.bib")).toBe(true);
    expect(matchesTexlabDocumentPath("readme.md")).toBe(false);
  });
});
