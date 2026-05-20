import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertInsideRoot,
  createProjectFile,
  deleteProjectPath,
  loadProject,
  outputPdfPath,
  renameProjectPath,
} from "./project";

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

describe("createProjectFile", () => {
  it("creates a tex file and returns an updated snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-create-"));
    try {
      const { snapshot, createdPath } = await createProjectFile(root, "", "notes.tex");
      expect(createdPath).toBe("notes.tex");
      expect(snapshot.files.some((file) => file.path === "notes.tex")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deduplicates file names when a collision exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-dedupe-"));
    try {
      await writeFile(join(root, "draft.tex"), "", "utf8");
      const { createdPath } = await createProjectFile(root, "", "draft.tex");
      expect(createdPath).toBe("draft-1.tex");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unsupported file extensions", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-invalid-"));
    try {
      await expect(createProjectFile(root, "", "readme.md")).rejects.toThrow(/Only LaTeX-related/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("renameProjectPath", () => {
  it("renames a file within the project", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-rename-"));
    try {
      await writeFile(join(root, "old.tex"), "content", "utf8");
      const { newPath, snapshot } = await renameProjectPath(root, "old.tex", "new.tex");
      expect(newPath).toBe("new.tex");
      expect(snapshot.files.some((file) => file.path === "new.tex")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects invalid target names", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-rename-invalid-"));
    try {
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
  it("removes a file from the project tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-delete-"));
    try {
      await writeFile(join(root, "remove.tex"), "", "utf8");
      const snapshot = await deleteProjectPath(root, "remove.tex");
      expect(snapshot.files.some((file) => file.path === "remove.tex")).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("cannot delete the project root", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-delete-root-"));
    try {
      await expect(deleteProjectPath(root, ".")).rejects.toThrow(/Cannot delete the project root/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
