import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkTexlab,
  startTexlabSession,
  stopAllTexlabSessions,
  stopTexlabSession,
} from "./texlab";

const HAS_TEXLAB = (() => {
  try {
    return process.platform !== "win32";
  } catch {
    return false;
  }
})();

describe("checkTexlab", () => {
  it("reports missing command gracefully", async () => {
    const result = await checkTexlab("__bigtex_missing_texlab__");
    expect(result.available).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!HAS_TEXLAB)("texlab session lifecycle", () => {
  it("starts and stops a session for a minimal project", async () => {
    const available = await checkTexlab();
    if (!available.available) return;

    const root = await mkdtemp(join(tmpdir(), "bigtex-texlab-"));
    try {
      await writeFile(
        join(root, "main.tex"),
        "\\documentclass{article}\\begin{document}Hi\\end{document}\n",
        "utf8",
      );

      const status = await startTexlabSession(root, "main.tex");
      expect(status.active).toBe(true);
      expect(status.rootPath).toBe(root);
      expect(status.mainFile).toBe("main.tex");

      await stopTexlabSession(root);
      expect(await startTexlabSession(root, "main.tex")).toMatchObject({ active: true });
      await stopTexlabSession(root);
    } finally {
      await stopAllTexlabSessions();
      await rm(root, { recursive: true, force: true });
    }
  });
});
