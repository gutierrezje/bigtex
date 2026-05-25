import { describe, expect, it } from "vitest";
import { isLspEditorPath, languageIdForLspPath } from "./editor-document-paths";

describe("isLspEditorPath", () => {
  it("includes LaTeX and BibTeX source kinds", () => {
    expect(isLspEditorPath("main.tex")).toBe(true);
    expect(isLspEditorPath("refs.bib")).toBe(true);
    expect(isLspEditorPath("macros.sty")).toBe(true);
    expect(isLspEditorPath("class.cls")).toBe(true);
    expect(isLspEditorPath("notes.md")).toBe(false);
  });
});

describe("languageIdForLspPath", () => {
  it("maps paths to Monaco language ids", () => {
    expect(languageIdForLspPath("main.tex")).toBe("latex");
    expect(languageIdForLspPath("refs.bib")).toBe("bibtex");
    expect(languageIdForLspPath("pkg.sty")).toBe("latex");
    expect(languageIdForLspPath("readme.txt")).toBe(null);
  });
});
