import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempUserDataDir = "";

vi.mock("electron", () => {
  return {
    app: {
      getPath: (name: string) => {
        if (name === "userData") {
          return tempUserDataDir;
        }
        return "/tmp";
      },
    },
  };
});

import { addRecent, clearRecents, getRecents, removeRecent } from "./recents";

describe("recents manager", () => {
  beforeEach(async () => {
    tempUserDataDir = await mkdtemp(join(tmpdir(), "bigtex-recents-test-"));
  });

  afterEach(async () => {
    await rm(tempUserDataDir, { recursive: true, force: true });
  });

  it("returns an empty array when no recents file exists", async () => {
    const list = await getRecents();
    expect(list).toEqual([]);
  });

  it("handles corrupted or invalid JSON structures gracefully by returning an empty array", async () => {
    const file = join(tempUserDataDir, "recents.json");
    await writeFile(file, "{invalid-json}", "utf8");

    const list = await getRecents();
    expect(list).toEqual([]);
  });

  it("saves, lists, and sorts recents when a workspace is loaded", async () => {
    const firstPath = resolve("/tmp/project-alpha");
    const secondPath = resolve("/tmp/project-beta");

    // Add first project
    let list = await addRecent(firstPath, "Alpha Workspace");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Alpha Workspace");
    expect(list[0].path).toBe(firstPath);
    expect(typeof list[0].lastOpened).toBe("number");

    // Add second project
    list = await addRecent(secondPath, "Beta Workspace");
    expect(list).toHaveLength(2);
    // The most recently added should be at the top
    expect(list[0].name).toBe("Beta Workspace");
    expect(list[1].name).toBe("Alpha Workspace");

    // Re-getting should fetch the correct list
    const fetched = await getRecents();
    expect(fetched).toEqual(list);
  });

  it("removes older duplicates and puts the most recently opened at the top", async () => {
    const pathAlpha = resolve("/tmp/project-alpha");
    const pathBeta = resolve("/tmp/project-beta");

    await addRecent(pathAlpha, "Alpha");
    await addRecent(pathBeta, "Beta");

    // Re-open Alpha. It should move to the top of the list.
    const list = await addRecent(pathAlpha, "Alpha Renovated");
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("Alpha Renovated");
    expect(list[0].path).toBe(pathAlpha);
    expect(list[1].name).toBe("Beta");
  });

  it("caps the recents list length at 10 items", async () => {
    for (let i = 1; i <= 12; i++) {
      await addRecent(resolve(`/tmp/project-${i}`), `Project ${i}`);
    }

    const list = await getRecents();
    expect(list).toHaveLength(10);
    // The very first ones (1 and 2) should have been pushed out.
    // Index 0 should be the latest (12), Index 9 should be 3.
    expect(list[0].name).toBe("Project 12");
    expect(list[9].name).toBe("Project 3");
    expect(list.some((item) => item.name === "Project 2")).toBe(false);
  });

  it("removes a single recent project item from history", async () => {
    const pathAlpha = resolve("/tmp/project-alpha");
    const pathBeta = resolve("/tmp/project-beta");

    await addRecent(pathAlpha, "Alpha");
    await addRecent(pathBeta, "Beta");

    const afterRemove = await removeRecent(pathAlpha);
    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0].name).toBe("Beta");

    const fetched = await getRecents();
    expect(fetched).toEqual(afterRemove);
  });

  it("clears all projects from history", async () => {
    await addRecent(resolve("/tmp/project-alpha"), "Alpha");
    await addRecent(resolve("/tmp/project-beta"), "Beta");

    await clearRecents();
    const fetched = await getRecents();
    expect(fetched).toEqual([]);

    // The file should contain an empty array "[]"
    const file = join(tempUserDataDir, "recents.json");
    const raw = await readFile(file, "utf8");
    expect(raw).toBe("[]");
  });
});
