import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertInsideRoot,
  createProjectFile,
  deleteProjectPath,
  loadProject,
  renameProjectPath,
} from "./project";

describe("assertInsideRoot", () => {
  it("allows paths in the tree and blocks escape", () => {
    const root = resolve("/tmp/bigtex-project-test");

    expect(assertInsideRoot(root, "main.tex")).toBe(resolve(root, "main.tex"));
    expect(() => assertInsideRoot(root, "../outside.tex")).toThrow(/outside/);
    expect(() => assertInsideRoot(root, "/etc/passwd")).toThrow(/outside/);
  });
});

describe("loadProject", () => {
  it("builds a tree, ignores aux noise, and infers main.tex", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-load-"));
    try {
      await writeFile(join(root, "main.tex"), "\\documentclass{article}\n", "utf8");
      await writeFile(join(root, "notes.aux"), "aux", "utf8");
      await writeFile(join(root, "main.out"), "out", "utf8");
      await writeFile(join(root, "main.synctex.gz"), "gzip", "utf8");
      await mkdir(join(root, ".tex-build"), { recursive: true });
      await writeFile(join(root, ".tex-build", "main.pdf"), "%PDF", "utf8");

      const snapshot = await loadProject(root);
      expect(snapshot.mainFile).toBe("main.tex");
      expect(snapshot.files.some((file) => file.name === "main.tex")).toBe(true);
      expect(snapshot.files.some((file) => file.name === "notes.aux")).toBe(false);
      expect(snapshot.files.some((file) => file.name === "main.out")).toBe(false);
      expect(snapshot.files.some((file) => file.name === "main.synctex.gz")).toBe(false);
      expect(snapshot.files.some((file) => file.name === ".tex-build")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("createProjectFile", () => {
  it("creates, dedupes names on collision, and rejects disallowed extensions", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-create-"));
    try {
      const first = await createProjectFile(root, "", "notes.tex");
      expect(first.createdPath).toBe("notes.tex");

      await writeFile(join(root, "draft.tex"), "", "utf8");
      const dup = await createProjectFile(root, "", "draft.tex");
      expect(dup.createdPath).toBe("draft-1.tex");

      await expect(createProjectFile(root, "", "readme.md")).rejects.toThrow(/Only LaTeX-related/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("renameProjectPath", () => {
  it("renames in-tree files and rejects invalid destination names", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-rename-"));
    try {
      await writeFile(join(root, "old.tex"), "content", "utf8");
      const { newPath, snapshot } = await renameProjectPath(root, "old.tex", "new.tex");
      expect(newPath).toBe("new.tex");
      expect(snapshot.files.some((file) => file.path === "new.tex")).toBe(true);

      await writeFile(join(root, "main.tex"), "", "utf8");
      await expect(renameProjectPath(root, "main.tex", "../escape.tex")).rejects.toThrow(
        /Invalid name/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("deleteProjectPath", () => {
  it("removes project entries but never the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-delete-"));
    try {
      await writeFile(join(root, "remove.tex"), "", "utf8");
      const snapshot = await deleteProjectPath(root, "remove.tex");
      expect(snapshot.files.some((file) => file.path === "remove.tex")).toBe(false);

      await expect(deleteProjectPath(root, ".")).rejects.toThrow(/Cannot delete the project root/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
