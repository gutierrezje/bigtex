import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { makeTempGitRepo, readRepoFile } from "../../../test/helpers/temp-git-repo";
import {
  applyUnifiedPatch,
  normalizePatchPath,
  normalizeUnifiedPatch,
  repairUnifiedPatchHunks,
  unifiedDiffFromTexts,
} from "./patch";

describe("repairUnifiedPatchHunks", () => {
  it("fixes hunk line counts to match the body", () => {
    const patch = [
      "--- a/main.tex",
      "+++ b/main.tex",
      "@@ -1,5 +1,3 @@",
      " context",
      "-removed",
      "+added",
    ].join("\n");

    const fixed = repairUnifiedPatchHunks(patch);
    expect(fixed).toContain("@@ -1,2 +1,2 @@");
  });

  it("prefixes bare hunk body lines with context space", () => {
    const patch = ["--- a/x", "+++ b/x", "@@ -1,1 +1,1 @@", "bare"].join("\n");
    const fixed = repairUnifiedPatchHunks(patch);
    expect(fixed).toContain(" bare");
  });
});

describe("normalizePatchPath", () => {
  const root = resolve("/tmp/proj");

  it("returns relative paths unchanged", () => {
    expect(normalizePatchPath("main.tex", root)).toBe("main.tex");
  });

  it("maps absolute paths under the project root", () => {
    expect(normalizePatchPath("/tmp/proj/chapters/intro.tex", root)).toBe("chapters/intro.tex");
  });

  it("strips redundant parent directory prefix", () => {
    const nestedRoot = resolve("/tmp/samples/minimal");
    expect(normalizePatchPath("samples/minimal/main.tex", nestedRoot)).toBe("main.tex");
  });

  it("preserves /dev/null", () => {
    expect(normalizePatchPath("/dev/null", root)).toBe("/dev/null");
  });
});

describe("normalizeUnifiedPatch", () => {
  it("rewrites file headers to project-relative paths", () => {
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
});

describe("unifiedDiffFromTexts", () => {
  it("returns empty string when texts are identical", () => {
    expect(unifiedDiffFromTexts("main.tex", "same", "same")).toBe("");
  });

  it("produces a unified diff with project-relative paths", () => {
    const patch = unifiedDiffFromTexts("main.tex", "old\n", "new\n");
    expect(patch).toContain("--- a/main.tex");
    expect(patch).toContain("+++ b/main.tex");
    expect(patch).toMatch(/^[-+]/m);
  });
});

describe("applyUnifiedPatch", () => {
  it("applies a valid patch to a tracked file", async () => {
    const { root, cleanup } = await makeTempGitRepo({ "main.tex": "old line\n" });
    try {
      const patch = unifiedDiffFromTexts("main.tex", "old line\n", "new line\n");
      const result = await applyUnifiedPatch({ rootPath: root, patch });
      expect(result.applied).toBe(true);
      expect(result.changedFiles).toContain("main.tex");
      expect(await readRepoFile(root, "main.tex")).toBe("new line\n");
    } finally {
      await cleanup();
    }
  });

  it("rejects patches that target paths outside the project", async () => {
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
  });

  it("repairs corrupt hunks before applying", async () => {
    const { root, cleanup } = await makeTempGitRepo({ "main.tex": "alpha\nbeta\n" });
    try {
      const patch = ["--- a/main.tex", "+++ b/main.tex", "@@ -1,5 +1,2 @@", " alpha", "-beta"].join(
        "\n",
      );

      const result = await applyUnifiedPatch({ rootPath: root, patch });
      expect(result.applied).toBe(true);
      expect(await readRepoFile(root, "main.tex")).toBe("alpha\n");
    } finally {
      await cleanup();
    }
  });

  it("returns a concise message when git apply fails", async () => {
    const { root, cleanup } = await makeTempGitRepo({ "main.tex": "unchanged\n" });
    try {
      const patch = [
        "--- a/main.tex",
        "+++ b/main.tex",
        "@@ -1,1 +1,1 @@",
        "-missing",
        "+content",
      ].join("\n");

      const result = await applyUnifiedPatch({ rootPath: root, patch });
      expect(result.applied).toBe(false);
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message.length).toBeLessThanOrEqual(241);
    } finally {
      await cleanup();
    }
  });
});
