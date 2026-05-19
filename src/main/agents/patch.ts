import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { PatchApplyRequest, PatchApplyResult } from "../../shared/domain";
import { assertInsideRoot } from "../files/project";

function pathFromDiffHeader(header: string): string | null {
  const rawPath = header.slice(4).trim().split("\t")[0];
  if (!rawPath || rawPath === "/dev/null") return null;
  return rawPath.replace(/^(?:a|b)\//, "");
}

function changedFilesFromPatch(patch: string): string[] {
  const files = new Set<string>();
  for (const line of patch.split(/\r?\n/)) {
    if (!line.startsWith("+++ ")) continue;
    const path = pathFromDiffHeader(line);
    if (path) files.add(path);
  }
  return [...files];
}

/** Normalize agent-produced diffs so `git apply` can match project-relative paths. */
export function normalizeUnifiedPatch(patch: string, rootPath: string): string {
  const root = resolve(rootPath);
  const rootPrefix = `${root}/`;

  return patch
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith("--- ") || line.startsWith("+++ ")) {
        const prefix = line.slice(0, 4);
        const path = pathFromDiffHeader(line);
        if (!path) return line;
        const normalized = path.startsWith(rootPrefix)
          ? path.slice(rootPrefix.length)
          : path.replace(/^(?:a|b)\//, "");
        const timestamp = line.includes("\t") ? line.slice(line.indexOf("\t")) : "";
        return `${prefix}${normalized}${timestamp}`;
      }
      return line;
    })
    .join("\n");
}

export function unifiedDiffFromTexts(
  relativePath: string,
  oldText: string,
  newText: string,
): string {
  if (oldText === newText) return "";

  const dir = mkdtempSync(join(tmpdir(), "bigtex-diff-"));
  try {
    const oldFile = join(dir, "old");
    const newFile = join(dir, "new");
    writeFileSync(oldFile, oldText);
    writeFileSync(newFile, newText);

    const result = spawnSync("diff", ["-u", oldFile, newFile], { encoding: "utf8" });
    const raw = result.stdout?.trim();
    if (!raw) {
      return [
        `--- a/${relativePath}`,
        `+++ b/${relativePath}`,
        "@@ -0,0 +1,1 @@",
        `+${newText}`,
      ].join("\n");
    }

    return raw
      .split(/\r?\n/)
      .map((line) => {
        if (line.startsWith("--- ")) return `--- a/${relativePath}`;
        if (line.startsWith("+++ ")) return `+++ b/${relativePath}`;
        return line;
      })
      .join("\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function runGitApply(
  rootPath: string,
  patch: string,
  strip: number,
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", ["apply", "--whitespace=nowarn", "--reject", `-${strip}`, "-"], {
      cwd: rootPath,
      shell: false,
    });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({ exitCode: 1, output: error.message });
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, output: output.trim() });
    });
    child.stdin.end(patch);
  });
}

export async function applyUnifiedPatch(request: PatchApplyRequest): Promise<PatchApplyResult> {
  const patch = normalizeUnifiedPatch(request.patch, request.rootPath);
  const changedFiles = changedFilesFromPatch(patch);
  for (const file of changedFiles) {
    assertInsideRoot(request.rootPath, file);
  }

  let result = await runGitApply(request.rootPath, patch, 0);
  if (result.exitCode !== 0) {
    result = await runGitApply(request.rootPath, patch, 1);
  }

  if (result.exitCode === 0) {
    return {
      applied: true,
      changedFiles,
      message: result.output || `Applied ${changedFiles.length} file change(s).`,
    };
  }

  return {
    applied: false,
    changedFiles,
    message: result.output || "Patch failed.",
  };
}
