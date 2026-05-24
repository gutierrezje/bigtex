import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTempGitRepo, readRepoFile } from "../../../test/helpers/temp-git-repo";
import {
  applyUnifiedPatch,
  normalizePatchPath,
  normalizeUnifiedPatch,
  repairUnifiedPatchHunks,
  resolvePatchPath,
  unifiedDiffFromTexts,
} from "./patch";

describe("patch hygiene (repair + paths)", () => {
  it("fixes corrupt hunk counts and maps agent paths into the repo", () => {
    const patch = [
      "--- a/main.tex",
      "+++ b/main.tex",
      "@@ -1,5 +1,3 @@",
      " context",
      "-removed",
      "+added",
    ].join("\n");

    expect(repairUnifiedPatchHunks(patch)).toContain("@@ -1,2 +1,2 @@");

    const root = resolve("/tmp/proj");
    expect(normalizePatchPath("main.tex", root)).toBe("main.tex");
    expect(normalizePatchPath("/tmp/proj/chapters/intro.tex", root)).toBe("chapters/intro.tex");
    expect(normalizePatchPath("samples/minimal/main.tex", resolve("/tmp/samples/minimal"))).toBe(
      "main.tex",
    );
    expect(normalizePatchPath("/dev/null", root)).toBe("/dev/null");
  });

  it("rewrites file headers so git apply sees project-relative paths", () => {
    const root = resolve("/tmp/samples/minimal");
    const patch = [
      "--- a/samples/minimal/main.tex",
      "+++ b/samples/minimal/main.tex",
      "@@ -1,1 +1,1 @@",
      " x",
    ].join("\n");

    const normalized = normalizeUnifiedPatch(patch, root);
    expect(normalized).toContain("--- main.tex");
    expect(normalized).toContain("+++ main.tex");
  });

  it("resolves nested paths when the agent drops parent directories", () => {
    const workshop = resolve("samples/workshop");
    const wrongPath = "samples/workshop/intro.tex";
    const resolved = resolvePatchPath(wrongPath, workshop, ["chapters/intro.tex"]);
    expect(resolved).toBe("chapters/intro.tex");

    const repo = resolve(".");
    expect(resolvePatchPath("chapters/intro.tex", repo)).toBe(
      "samples/workshop/chapters/intro.tex",
    );
    expect(resolvePatchPath(wrongPath, repo)).toBe("samples/workshop/chapters/intro.tex");
  });

  it("rewrites diff headers to nested paths before git apply", () => {
    const workshop = resolve("samples/workshop");
    const patch = [
      "--- a/samples/workshop/intro.tex",
      "+++ b/samples/workshop/intro.tex",
      "@@ -1,1 +1,1 @@",
      " x",
    ].join("\n");

    const normalized = normalizeUnifiedPatch(patch, workshop, ["chapters/intro.tex"]);
    expect(normalized).toContain("--- chapters/intro.tex");
    expect(normalized).toContain("+++ chapters/intro.tex");
  });
});

describe("unifiedDiffFromTexts", () => {
  it("emits a usable unified diff for simple edits", () => {
    const patch = unifiedDiffFromTexts("main.tex", "old\n", "new\n");
    expect(patch).toContain("--- a/main.tex");
    expect(patch).toContain("+++ b/main.tex");
    expect(patch).toMatch(/^[-+]/m);
  });
});

describe("applyUnifiedPatch", () => {
  it("applies patches to nested project files when paths omit subdirectories", async () => {
    const workshop = resolve("samples/workshop");
    const introPath = join(workshop, "chapters/intro.tex");
    const { readFile } = await import("node:fs/promises");
    const before = await readFile(introPath, "utf8");
    const marker = "% nested-patch-test-marker\n";
    if (before.includes(marker)) {
      const without = before.replace(marker, "");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(introPath, without, "utf8");
    }

    const current = await readFile(introPath, "utf8");
    const patch = unifiedDiffFromTexts("intro.tex", current, `${marker}${current}`);

    const wrongHeaderPatch = patch
      .replaceAll("--- a/intro.tex", "--- a/samples/workshop/intro.tex")
      .replaceAll("+++ b/intro.tex", "+++ b/samples/workshop/intro.tex");

    const result = await applyUnifiedPatch({
      rootPath: workshop,
      patch: wrongHeaderPatch,
      hintPaths: ["chapters/intro.tex"],
    });
    expect(result.applied).toBe(true);
    expect(result.changedFiles).toEqual(["chapters/intro.tex"]);

    const after = await readFile(introPath, "utf8");
    expect(after).toContain(marker);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(introPath, current, "utf8");
  });

  it("applies clean patches, blocks path escape, and repairs bad hunks", async () => {
    {
      const { root, cleanup } = await makeTempGitRepo({ "main.tex": "old line\n" });
      try {
        const patch = unifiedDiffFromTexts("main.tex", "old line\n", "new line\n");
        const result = await applyUnifiedPatch({ rootPath: root, patch });
        expect(result.applied).toBe(true);
        expect(await readRepoFile(root, "main.tex")).toBe("new line\n");
      } finally {
        await cleanup();
      }
    }

    {
      const { root, cleanup } = await makeTempGitRepo({ "main.tex": "x\n" });
      try {
        const patch = [
          "--- a/main.tex",
          "+++ b/../../../outside.tex",
          "@@ -1,1 +1,1 @@",
          "-x",
          "+y",
        ].join("\n");

        await expect(applyUnifiedPatch({ rootPath: root, patch })).rejects.toThrow(/outside/);
      } finally {
        await cleanup();
      }
    }

    {
      const { root, cleanup } = await makeTempGitRepo({ "main.tex": "alpha\nbeta\n" });
      try {
        const patch = [
          "--- a/main.tex",
          "+++ b/main.tex",
          "@@ -1,5 +1,2 @@",
          " alpha",
          "-beta",
        ].join("\n");

        const result = await applyUnifiedPatch({ rootPath: root, patch });
        expect(result.applied).toBe(true);
        expect(await readRepoFile(root, "main.tex")).toBe("alpha\n");
      } finally {
        await cleanup();
      }
    }
  });
});
