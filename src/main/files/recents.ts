import { readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { app } from "electron";
import type { RecentProject } from "../../shared/domain";

function getStorePath(): string {
  // If app is not ready yet, app.getPath might fail or behave unexpectedly.
  // But this will only be called after whenReady when IPC starts.
  return join(app.getPath("userData"), "recents.json");
}

export async function getRecents(): Promise<RecentProject[]> {
  try {
    const file = getStorePath();
    const data = await readFile(file, "utf8");
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Validate structure briefly
      return parsed.filter(
        (item): item is RecentProject =>
          typeof item === "object" &&
          item !== null &&
          typeof item.path === "string" &&
          typeof item.name === "string" &&
          typeof item.lastOpened === "number",
      );
    }
  } catch (_error) {
    // If file doesn't exist, return empty array
  }
  return [];
}

export async function addRecent(
  projectPath: string,
  customName?: string,
): Promise<RecentProject[]> {
  const normalizedPath = resolve(projectPath);
  const name = customName || basename(normalizedPath) || normalizedPath;
  const list = await getRecents();

  // Filter out any existing entries with the same path
  const filtered = list.filter((item) => resolve(item.path) !== normalizedPath);

  // Prepend new entry
  const updated: RecentProject[] = [
    {
      path: normalizedPath,
      name,
      lastOpened: Date.now(),
    },
    ...filtered,
  ];

  // Limit to 10 recents
  const limited = updated.slice(0, 10);

  try {
    const file = getStorePath();
    await writeFile(file, JSON.stringify(limited, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write recents.json", error);
  }

  return limited;
}

export async function removeRecent(projectPath: string): Promise<RecentProject[]> {
  const normalizedPath = resolve(projectPath);
  const list = await getRecents();
  const filtered = list.filter((item) => resolve(item.path) !== normalizedPath);

  try {
    const file = getStorePath();
    await writeFile(file, JSON.stringify(filtered, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to write recents.json", error);
  }

  return filtered;
}

export async function clearRecents(): Promise<void> {
  try {
    const file = getStorePath();
    await writeFile(file, "[]", "utf8");
  } catch (error) {
    console.error("Failed to clear recents.json", error);
  }
}
