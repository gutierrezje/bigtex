import { describe, expect, it } from "vitest";
import { NEW_FILE_TEMPLATES, resolveNewFileName, templateById } from "./newFileTemplates";

describe("NEW_FILE_TEMPLATES", () => {
  it("lists the LaTeX-related kinds users can add from the workspace", () => {
    expect(NEW_FILE_TEMPLATES.map((t) => t.extension)).toEqual([".tex", ".bib", ".sty", ".cls"]);
  });
});

describe("resolveNewFileName", () => {
  it("appends the template extension when the stem omits it", () => {
    expect(resolveNewFileName("chapter-1", ".tex")).toBe("chapter-1.tex");
  });

  it("keeps the name when the extension is already present", () => {
    expect(resolveNewFileName("refs.bib", ".bib")).toBe("refs.bib");
  });

  it("rejects empty or path-like stems", () => {
    expect(resolveNewFileName("", ".tex")).toBeNull();
    expect(resolveNewFileName("foo/bar", ".tex")).toBeNull();
  });
});

describe("templateById", () => {
  it("returns the matching template", () => {
    expect(templateById("bib")?.extension).toBe(".bib");
  });
});
