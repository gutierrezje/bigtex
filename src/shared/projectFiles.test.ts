import { describe, expect, it } from "vitest";
import { isCreatableFileName, parentDirectoryPath } from "./projectFiles";

describe("isCreatableFileName", () => {
  it("accepts LaTeX-related extensions", () => {
    expect(isCreatableFileName("main.tex")).toBe(true);
    expect(isCreatableFileName("refs.BIB")).toBe(true);
    expect(isCreatableFileName("style.sty")).toBe(true);
    expect(isCreatableFileName("class.cls")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isCreatableFileName("readme.md")).toBe(false);
    expect(isCreatableFileName("data.json")).toBe(false);
  });
});

describe("parentDirectoryPath", () => {
  it("returns parent path or empty string at root", () => {
    expect(parentDirectoryPath("chapters/intro.tex")).toBe("chapters");
    expect(parentDirectoryPath("main.tex")).toBe("");
  });
});
