import { describe, expect, it } from "vitest";
import {
  closeEditorTab,
  computeTabLabels,
  focusOrOpenEditor,
  focusOrOpenPdf,
  getActiveEditor,
  getActivePdf,
  initialEditorTabs,
  initialPdfTabs,
  listDirtyEditorPaths,
  renameEditorPath,
  updateEditorContent,
} from "./documentTabs";
import type { OpenFile, PdfPayload } from "./domain";

function editorFile(path: string, content = ""): OpenFile {
  return {
    path,
    absolutePath: `/proj/${path}`,
    content,
    dirty: false,
    loadedAt: 1,
  };
}

function pdfPayload(path: string): PdfPayload {
  return {
    path,
    data: new Uint8Array([1]),
    loadedAt: 1,
  };
}

describe("computeTabLabels", () => {
  it("shows only the file name when names are unique", () => {
    const labels = computeTabLabels(["src/main.tex", "src/intro.tex"]);
    expect(labels.get("src/main.tex")).toEqual({ name: "main.tex" });
    expect(labels.get("src/intro.tex")).toEqual({ name: "intro.tex" });
  });

  it("adds the shortest distinguishing folder when names collide", () => {
    const labels = computeTabLabels(["src/a/index.ts", "src/b/index.ts"]);
    expect(labels.get("src/a/index.ts")).toEqual({ name: "index.ts", hint: "…/a" });
    expect(labels.get("src/b/index.ts")).toEqual({ name: "index.ts", hint: "…/b" });
  });

  it("deepens the folder hint until it is unique and marks truncation", () => {
    const labels = computeTabLabels(["src/x/shared/index.ts", "src/y/shared/index.ts"]);
    expect(labels.get("src/x/shared/index.ts")).toEqual({ name: "index.ts", hint: "…/x/shared" });
    expect(labels.get("src/y/shared/index.ts")).toEqual({ name: "index.ts", hint: "…/y/shared" });
  });

  it("does not add a truncation marker when the full folder path is shown", () => {
    const labels = computeTabLabels(["a/main.tex", "b/main.tex"]);
    expect(labels.get("a/main.tex")).toEqual({ name: "main.tex", hint: "a" });
  });
});

describe("focusOrOpenEditor", () => {
  it("opens the first editor tab when none are open", () => {
    const file = editorFile("main.tex");
    const next = focusOrOpenEditor(initialEditorTabs(), file);

    expect(next.files).toHaveLength(1);
    expect(next.activePath).toBe("main.tex");
    expect(getActiveEditor(next)?.content).toBe("");
  });

  it("focuses an existing editor tab instead of duplicating the path", () => {
    const first = focusOrOpenEditor(initialEditorTabs(), editorFile("a.tex"));
    const second = focusOrOpenEditor(first, editorFile("b.tex"));
    const third = focusOrOpenEditor(second, editorFile("a.tex", "updated"));

    expect(third.files).toHaveLength(2);
    expect(third.activePath).toBe("a.tex");
    expect(getActiveEditor(third)?.content).toBe("");
  });
});

describe("closeEditorTab", () => {
  it("removes a tab and activates the next tab to the right", () => {
    let state = focusOrOpenEditor(initialEditorTabs(), editorFile("a.tex"));
    state = focusOrOpenEditor(state, editorFile("b.tex"));
    state = focusOrOpenEditor(state, editorFile("c.tex"));
    state = closeEditorTab(state, "b.tex");

    expect(state.files.map((f) => f.path)).toEqual(["a.tex", "c.tex"]);
    expect(state.activePath).toBe("c.tex");
  });

  it("leaves no active path when the last editor tab is closed", () => {
    const state = closeEditorTab(
      focusOrOpenEditor(initialEditorTabs(), editorFile("only.tex")),
      "only.tex",
    );

    expect(state.files).toHaveLength(0);
    expect(state.activePath).toBeNull();
  });
});

describe("focusOrOpenPdf", () => {
  it("reloads bytes when the pdf tab already exists", () => {
    const first = focusOrOpenPdf(initialPdfTabs(), pdfPayload("out.pdf"));
    const reloaded = focusOrOpenPdf(first, {
      ...pdfPayload("out.pdf"),
      data: new Uint8Array([9]),
      loadedAt: 2,
    });

    expect(reloaded.pdfs).toHaveLength(1);
    expect(reloaded.activePath).toBe("out.pdf");
    expect(getActivePdf(reloaded)?.loadedAt).toBe(2);
    expect(getActivePdf(reloaded)?.data[0]).toBe(9);
  });
});

describe("renameEditorPath", () => {
  it("updates every editor tab that used the old path", () => {
    let state = focusOrOpenEditor(initialEditorTabs(), editorFile("old.tex"));
    state = focusOrOpenEditor(state, editorFile("other.tex"));
    state = renameEditorPath(state, "old.tex", "new.tex", editorFile("new.tex", "body"));

    expect(state.files.map((f) => f.path)).toEqual(["new.tex", "other.tex"]);
    expect(state.activePath).toBe("other.tex");
    expect(state.files.find((f) => f.path === "new.tex")?.content).toBe("body");
  });
});

describe("updateEditorContent", () => {
  it("lists paths that still have unsaved drafts", () => {
    let state = focusOrOpenEditor(initialEditorTabs(), editorFile("a.tex"));
    state = focusOrOpenEditor(state, editorFile("b.tex"));
    state = updateEditorContent(state, "a.tex", "draft", true);

    expect(listDirtyEditorPaths(state)).toEqual(["a.tex"]);
  });
});
