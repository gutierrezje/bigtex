import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertInsideRoot, loadProject, outputPdfPath } from "./project";

describe("assertInsideRoot", () => {
  const root = resolve("/tmp/bigtex-project-test");

  it("resolves relative paths inside the root", () => {
    expect(assertInsideRoot(root, "main.tex")).toBe(resolve(root, "main.tex"));
  });

  it("rejects paths that escape the project", () => {
    expect(() => assertInsideRoot(root, "../outside.tex")).toThrow(/outside/);
    expect(() => assertInsideRoot(root, "/etc/passwd")).toThrow(/outside/);
  });
});

describe("outputPdfPath", () => {
  it("maps tex source to sibling pdf path", () => {
    const root = resolve("/tmp/proj");
    expect(outputPdfPath(root, "chapters/intro.tex")).toBe(resolve(root, "chapters/intro.pdf"));
  });
});

describe("loadProject", () => {
  it("builds a tree and infers main.tex as main file", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-load-"));
    try {
      await writeFile(join(root, "main.tex"), "\\documentclass{article}\n", "utf8");
      await writeFile(join(root, "notes.aux"), "aux", "utf8");

      const snapshot = await loadProject(root);
      expect(snapshot.mainFile).toBe("main.tex");
      expect(snapshot.files.some((file) => file.name === "main.tex")).toBe(true);
      expect(snapshot.files.some((file) => file.name === "notes.aux")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
