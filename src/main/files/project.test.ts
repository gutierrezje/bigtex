import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertInsideRoot,
  createProjectFile,
  createProjectFolder,
  deleteProjectPath,
  isNewProjectDirectoryEmpty,
  loadProject,
  renameProjectPath,
  scaffoldBlankProject,
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

describe("isNewProjectDirectoryEmpty", () => {
  it("treats missing, empty, and aux-only folders as empty", async () => {
    const missing = join(tmpdir(), `bigtex-missing-${Date.now()}`);
    expect(await isNewProjectDirectoryEmpty(missing)).toBe(true);

    const empty = await mkdtemp(join(tmpdir(), "bigtex-empty-"));
    try {
      expect(await isNewProjectDirectoryEmpty(empty)).toBe(true);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }

    const auxOnly = await mkdtemp(join(tmpdir(), "bigtex-aux-"));
    try {
      await writeFile(join(auxOnly, "notes.aux"), "aux", "utf8");
      await mkdir(join(auxOnly, ".tex-build"), { recursive: true });
      expect(await isNewProjectDirectoryEmpty(auxOnly)).toBe(true);
    } finally {
      await rm(auxOnly, { recursive: true, force: true });
    }
  });

  it("detects existing source files", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-has-tex-"));
    try {
      await writeFile(join(root, "chapter.tex"), "%", "utf8");
      expect(await isNewProjectDirectoryEmpty(root)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("scaffoldBlankProject", () => {
  it("creates main.tex and references.bib when missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-scaffold-"));
    try {
      const snapshot = await scaffoldBlankProject(root);
      expect(snapshot.mainFile).toBe("main.tex");
      expect(snapshot.files.some((file) => file.name === "main.tex")).toBe(true);
      expect(snapshot.files.some((file) => file.name === "references.bib")).toBe(true);

      const again = await scaffoldBlankProject(root);
      expect(again.files.filter((file) => file.name === "main.tex")).toHaveLength(1);
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

describe("createProjectFolder", () => {
  it("creates folders in-tree and dedupes names on collision", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-folder-"));
    try {
      const first = await createProjectFolder(root, "", "chapters");
      expect(first.createdPath).toBe("chapters");

      await mkdir(join(root, "figures"));
      const dup = await createProjectFolder(root, "", "figures");
      expect(dup.createdPath).toBe("figures-1");

      const nested = await createProjectFolder(root, "chapters", "intro");
      expect(nested.createdPath).toBe("chapters/intro");
      const chapters = nested.snapshot.files.find((file) => file.path === "chapters");
      expect(chapters?.children?.some((child) => child.path === "chapters/intro")).toBe(true);

      await expect(createProjectFolder(root, "", "bad/name")).rejects.toThrow(
        /Invalid folder name/,
      );
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
