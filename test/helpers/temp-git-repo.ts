import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EMPTY_GIT_TEMPLATE = join(tmpdir(), "bigtex-empty-git-template");

function ensureEmptyGitTemplate(): string {
  mkdirSync(EMPTY_GIT_TEMPLATE, { recursive: true });
  return EMPTY_GIT_TEMPLATE;
}

export async function makeTempGitRepo(
  files: Record<string, string> = {},
): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "bigtex-test-"));

  const init = spawnSync("git", ["init", "-q", `--template=${ensureEmptyGitTemplate()}`], {
    cwd: root,
  });
  if (init.status !== 0) {
    throw new Error(`git init failed: ${init.stderr?.toString()}`);
  }

  spawnSync("git", ["config", "user.email", "test@bigtex.local"], { cwd: root });
  spawnSync("git", ["config", "user.name", "BigTeX Test"], { cwd: root });

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(root, relativePath);
    await writeFile(absolutePath, content, "utf8");
  }

  if (Object.keys(files).length > 0) {
    spawnSync("git", ["add", "."], { cwd: root });
    spawnSync("git", ["commit", "-q", "-m", "init"], { cwd: root });
  }

  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export async function readRepoFile(root: string, relativePath: string): Promise<string> {
  return readFile(join(root, relativePath), "utf8");
}
