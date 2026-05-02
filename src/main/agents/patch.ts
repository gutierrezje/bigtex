import { spawn } from "node:child_process";
import type { PatchApplyRequest, PatchApplyResult } from "../../shared/domain";
import { assertInsideRoot } from "../files/project";

function changedFilesFromPatch(patch: string): string[] {
  const files = new Set<string>();
  for (const line of patch.split(/\r?\n/)) {
    if (!line.startsWith("+++ ")) continue;
    const rawPath = line.slice(4).trim();
    if (rawPath === "/dev/null") continue;
    files.add(rawPath.replace(/^b\//, ""));
  }
  return [...files];
}

export async function applyUnifiedPatch(request: PatchApplyRequest): Promise<PatchApplyResult> {
  const changedFiles = changedFilesFromPatch(request.patch);
  for (const file of changedFiles) {
    assertInsideRoot(request.rootPath, file);
  }

  return new Promise((resolve) => {
    const child = spawn("git", ["apply", "--whitespace=nowarn", "--reject", "-"], {
      cwd: request.rootPath,
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
      resolve({
        applied: false,
        changedFiles,
        message: error.message,
      });
    });
    child.on("close", (exitCode) => {
      resolve({
        applied: exitCode === 0,
        changedFiles,
        message:
          output.trim() ||
          (exitCode === 0 ? `Applied ${changedFiles.length} file change(s).` : "Patch failed."),
      });
    });
    child.stdin.end(request.patch);
  });
}
