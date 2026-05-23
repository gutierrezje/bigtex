import { describe, expect, it } from "vitest";
import {
  isIgnoredLatexArtifactFile,
  isIgnoredProjectDirectory,
  isIgnoredProjectRelativePath,
  LATEX_BUILD_DIR,
  latexOutputPdfPath,
} from "./latexArtifacts";

describe("latexArtifacts", () => {
  it("hides the build folder and common aux extensions", () => {
    expect(isIgnoredProjectDirectory(LATEX_BUILD_DIR)).toBe(true);
    expect(isIgnoredProjectDirectory("src")).toBe(false);

    expect(isIgnoredLatexArtifactFile("main.aux")).toBe(true);
    expect(isIgnoredLatexArtifactFile("main.tex")).toBe(false);
    expect(isIgnoredLatexArtifactFile("main.synctex(busy)")).toBe(true);
    expect(isIgnoredLatexArtifactFile("main.out")).toBe(true);
  });

  it("matches compound extensions (node extname only sees the last segment)", () => {
    expect(isIgnoredLatexArtifactFile("JesusGutierrezCPP.synctex.gz")).toBe(true);
    expect(isIgnoredLatexArtifactFile("DataRes.synctex.gz")).toBe(true);
    expect(isIgnoredLatexArtifactFile("archive.gz")).toBe(false);
    expect(isIgnoredProjectRelativePath("build/main.fdb_latexmk")).toBe(true);
    expect(isIgnoredProjectRelativePath("main.tex")).toBe(false);
  });

  it("hides paths under ignored directories", () => {
    expect(isIgnoredProjectRelativePath(`${LATEX_BUILD_DIR}/main.pdf`)).toBe(true);
    expect(isIgnoredProjectRelativePath("chapters/intro.aux")).toBe(true);
    expect(isIgnoredProjectRelativePath("main.tex")).toBe(false);
  });

  it("places compiled PDFs in the build directory", () => {
    expect(latexOutputPdfPath("/proj", "main.tex")).toBe(`/proj/${LATEX_BUILD_DIR}/main.pdf`);
    expect(latexOutputPdfPath("/proj", "chapters/paper.tex")).toBe(
      `/proj/${LATEX_BUILD_DIR}/paper.pdf`,
    );
  });
});
