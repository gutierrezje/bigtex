import { type FSWatcher, watch } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type { AgentEvent } from "../../shared/domain";
import { isIgnoredProjectRelativePath } from "../../shared/latexArtifacts";

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
    if (isIgnoredProjectRelativePath(relativePath)) return;
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
