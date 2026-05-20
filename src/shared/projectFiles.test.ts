import { describe, expect, it } from "vitest";
import { isCreatableFileName, parentDirectoryPath } from "./projectFiles";

describe("projectFiles", () => {
  it("gates new-file extensions and exposes parent folders", () => {
    expect(isCreatableFileName("main.tex")).toBe(true);
    expect(isCreatableFileName("refs.BIB")).toBe(true);
    expect(isCreatableFileName("style.sty")).toBe(true);
    expect(isCreatableFileName("class.cls")).toBe(true);
    expect(isCreatableFileName("readme.md")).toBe(false);

    expect(parentDirectoryPath("chapters/intro.tex")).toBe("chapters");
    expect(parentDirectoryPath("main.tex")).toBe("");
  });
});
