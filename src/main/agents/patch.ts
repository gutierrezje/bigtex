import { spawn, spawnSync } from "node:child_process";
import { type Dirent, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { PatchApplyRequest, PatchApplyResult } from "../../shared/domain";
import { shouldHideProjectTreeEntry } from "../../shared/latexArtifacts";
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

const HUNK_HEADER_PATTERN = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/** Fix LLM hunks where @@ old/new line counts do not match the hunk body (git: corrupt patch). */
export function repairUnifiedPatchHunks(patch: string): string {
  const lines = patch.split(/\r?\n/);
  const out: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith("@@ ")) {
      out.push(line);
      index += 1;
      continue;
    }

    const headerLine = line;
    index += 1;
    const body: string[] = [];

    while (index < lines.length) {
      const bodyLine = lines[index];
      if (
        bodyLine.startsWith("@@ ") ||
        bodyLine.startsWith("--- ") ||
        bodyLine.startsWith("+++ ")
      ) {
        break;
      }

      if (
        bodyLine.startsWith("\\") ||
        bodyLine.startsWith(" ") ||
        bodyLine.startsWith("+") ||
        bodyLine.startsWith("-")
      ) {
        body.push(bodyLine);
      } else if (bodyLine.length > 0) {
        body.push(` ${bodyLine}`);
      } else {
        body.push(" ");
      }
      index += 1;
    }

    out.push(repairHunkHeaderLine(headerLine, body));
    out.push(...body);
  }

  return out.join("\n");
}

function repairHunkHeaderLine(header: string, body: string[]): string {
  let oldCount = 0;
  let newCount = 0;

  for (const line of body) {
    if (line.startsWith("\\")) continue;
    const prefix = line[0];
    if (prefix === " " || prefix === "-") oldCount += 1;
    if (prefix === " " || prefix === "+") newCount += 1;
  }

  const match = header.match(HUNK_HEADER_PATTERN);
  if (!match) return header;

  const [, oldStart, newStart, suffix] = match;
  return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${suffix}`;
}

/** Map diff paths to project-root-relative paths for `git apply` (cwd = project root). */
export function normalizePatchPath(path: string, rootPath: string): string {
  let cleaned = path.replace(/^(?:a|b)\//, "").trim();
  if (!cleaned || cleaned === "/dev/null") return cleaned;

  const root = resolve(rootPath);

  if (isAbsolute(cleaned)) {
    const rel = relative(root, resolve(cleaned));
    if (!rel.startsWith("..") && rel !== "") {
      return rel.split(sep).join("/");
    }
  }

  const rootPrefix = `${root}/`;
  if (cleaned.startsWith(rootPrefix)) {
    cleaned = cleaned.slice(rootPrefix.length);
  }

  // Agent paths like `samples/minimal/main.tex` when project root is `.../samples/minimal`.
  let dir = root;
  let longestPrefix = "";
  for (;;) {
    const parent = dirname(dir);
    if (parent === dir) break;
    const prefix = relative(parent, root).split(sep).join("/");
    if (
      prefix &&
      prefix !== "." &&
      (cleaned === prefix || cleaned.startsWith(`${prefix}/`)) &&
      prefix.length > longestPrefix.length
    ) {
      longestPrefix = prefix;
    }
    dir = parent;
  }
  if (longestPrefix) {
    cleaned = cleaned === longestPrefix ? "" : cleaned.slice(longestPrefix.length + 1);
  }

  return cleaned;
}

const PATCH_PATH_SEARCH_MAX_DEPTH = 8;

function findRelativePathsByBasename(rootPath: string, fileName: string): string[] {
  const root = resolve(rootPath);
  const matches: string[] = [];

  function walk(directoryPath: string, depth: number, relativePrefix: string): void {
    if (depth > PATCH_PATH_SEARCH_MAX_DEPTH) return;

    let entries: Dirent[];
    try {
      entries = readdirSync(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (shouldHideProjectTreeEntry(entry.name, entry.isDirectory())) continue;

      const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      if (!entry.isDirectory()) {
        if (entry.name === fileName) matches.push(relativePath);
        continue;
      }

      walk(join(directoryPath, entry.name), depth + 1, relativePath);
    }
  }

  walk(root, 0, "");
  return matches;
}

function projectRelativePathExists(rootPath: string, relativePath: string): boolean {
  if (!relativePath || relativePath === "/dev/null") return false;
  return existsSync(join(resolve(rootPath), relativePath));
}

/** Map agent paths to an existing project file (nested dirs, repo-root prefixes). */
export function resolvePatchPath(
  path: string,
  rootPath: string,
  hintPaths: readonly string[] = [],
): string {
  const normalized = normalizePatchPath(path, rootPath);
  if (!normalized || normalized === "/dev/null") return normalized;
  if (projectRelativePathExists(rootPath, normalized)) return normalized;

  const hinted = hintPaths.filter(
    (hint) => hint === normalized || basename(hint) === basename(normalized),
  );
  if (hinted.length === 1 && projectRelativePathExists(rootPath, hinted[0])) {
    return hinted[0];
  }

  const matches = findRelativePathsByBasename(rootPath, basename(normalized));
  if (matches.length === 1) return matches[0];

  const parent = dirname(normalized).split("/").filter(Boolean).at(-1);
  if (parent) {
    const withParent = matches.filter((match) => match.split("/").includes(parent));
    if (withParent.length === 1) return withParent[0];
  }

  if (hinted.length === 1 && projectRelativePathExists(rootPath, hinted[0])) {
    return hinted[0];
  }
  return normalized;
}

/** Normalize agent-produced diffs so `git apply` can match project-relative paths. */
export function normalizeUnifiedPatch(
  patch: string,
  rootPath: string,
  hintPaths: readonly string[] = [],
): string {
  return patch
    .split(/\r?\n/)
    .map((line) => {
      if (line.startsWith("--- ") || line.startsWith("+++ ")) {
        const prefix = line.slice(0, 4);
        const path = pathFromDiffHeader(line);
        if (!path) return line;
        const normalized = resolvePatchPath(path, rootPath, hintPaths);
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

function summarizeGitApplyOutput(output: string): string {
  if (!output) return "Patch failed.";
  const lines = output.split(/\r?\n/).filter(Boolean);
  const errorLines = lines.filter((line) => line.startsWith("error:"));
  const patchFailed = errorLines.find((line) => /patch failed/i.test(line));
  if (patchFailed) {
    const location = patchFailed.replace(/^error:\s*/i, "").trim();
    return `${location} — file content has changed since the patch was generated. Save your changes and ask the agent to try again.`;
  }
  const rejected = lines.find((line) => /Rejected hunk/i.test(line));
  if (rejected) return rejected.trim();
  const errorLine = errorLines[0];
  if (errorLine) return errorLine.replace(/^error:\s*/i, "").trim();
  if (output.includes("usage: git apply")) {
    return lines[0]?.trim() || "Patch failed.";
  }
  return output.length > 240 ? `${output.slice(0, 240)}…` : output;
}

/** Remove any .rej files left by previous git apply --reject runs. */
function cleanupRejFiles(rootPath: string, changedFiles: string[]): void {
  const root = resolve(rootPath);
  for (const file of changedFiles) {
    const rejPath = join(root, `${file}.rej`);
    try {
      rmSync(rejPath, { force: true });
    } catch {
      // Best-effort cleanup — ignore errors.
    }
  }
}

async function runGitApply(
  rootPath: string,
  patch: string,
  strip: number,
): Promise<{ exitCode: number | null; output: string }> {
  const args = ["apply", "--whitespace=nowarn", `-p${strip}`, "-"];

  return new Promise((resolve) => {
    const child = spawn("git", args, {
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
    const payload = patch.endsWith("\n") ? patch : `${patch}\n`;
    child.stdin.end(payload);
  });
}

export async function applyUnifiedPatch(request: PatchApplyRequest): Promise<PatchApplyResult> {
  const patch = repairUnifiedPatchHunks(
    normalizeUnifiedPatch(request.patch, request.rootPath, request.hintPaths ?? []),
  );
  const changedFiles = changedFilesFromPatch(patch);
  for (const file of changedFiles) {
    assertInsideRoot(request.rootPath, file);
  }

  // Patches are normalized to project-relative paths (no a/ prefix). Retrying with -p1
  // would strip the first segment (e.g. chapters/math.tex → math.tex) and break nested files.
  const result = await runGitApply(request.rootPath, patch, 0);

  if (result.exitCode === 0) {
    return {
      applied: true,
      changedFiles,
      message: result.output || `Applied ${changedFiles.length} file change(s).`,
    };
  }

  cleanupRejFiles(request.rootPath, changedFiles);
  return {
    applied: false,
    changedFiles,
    message: summarizeGitApplyOutput(result.output),
  };
}
