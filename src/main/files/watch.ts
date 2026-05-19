import { type FSWatcher, watch } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import type { AgentEvent } from "../../shared/domain";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "out",
  ".latex-cache",
]);

const IGNORED_EXTENSIONS = new Set([
  ".aux",
  ".bbl",
  ".blg",
  ".fls",
  ".fdb_latexmk",
  ".log",
  ".synctex.gz",
]);

function isIgnoredProjectPath(relativePath: string): boolean {
  const normalized = relativePath.split(sep).join("/");
  const segments = normalized.split("/");
  if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) return true;
  return IGNORED_EXTENSIONS.has(extname(normalized).toLowerCase());
}

export function startProjectWatch(
  rootPath: string,
  runId: string,
  emit: (event: AgentEvent) => void,
): () => void {
  const root = resolve(rootPath);
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;

  const flush = (): void => {
    timer = null;
    if (pending.size === 0) return;
    const paths = [...pending];
    pending.clear();
    emit({ type: "filesChanged", runId, paths, at: Date.now() });
  };

  const schedule = (relativePath: string): void => {
    if (isIgnoredProjectPath(relativePath)) return;
    pending.add(relativePath);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 200);
  };

  try {
    watcher = watch(root, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      const rel = relative(root, resolve(root, filename)).split(sep).join("/");
      if (!rel || rel.startsWith("..")) return;
      schedule(rel);
    });
  } catch {
    return () => {
      if (timer) clearTimeout(timer);
    };
  }

  return () => {
    watcher?.close();
    if (timer) clearTimeout(timer);
    pending.clear();
  };
}
