import { describe, expect, it } from "vitest";
import { fileUriToProjectRelativePath, pathToFileUri } from "./file-uri";

describe("fileUriToProjectRelativePath", () => {
  const root = "/Users/me/thesis";

  it("returns a relative path for files under the project root", () => {
    const uri = pathToFileUri(`${root}/chapters/intro.tex`);
    expect(fileUriToProjectRelativePath(uri, root)).toBe("chapters/intro.tex");
  });

  it("returns null for URIs outside the project", () => {
    expect(fileUriToProjectRelativePath(pathToFileUri("/other/file.tex"), root)).toBe(null);
  });
});
