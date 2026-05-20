import { describe, expect, it } from "vitest";
import { extractPatch } from "./extract-patch";

describe("extractPatch", () => {
  it("returns null when no fenced diff blocks exist", () => {
    expect(extractPatch("plain assistant reply")).toBeNull();
  });

  it("extracts a single fenced diff block", () => {
    const text = "Apply this:\n```diff\n--- a/main.tex\n+++ b/main.tex\n```";
    expect(extractPatch(text)).toContain("--- a/main.tex");
  });

  it("joins multiple fenced diff blocks", () => {
    const text = [
      "```diff",
      "--- a/one.tex",
      "+++ b/one.tex",
      "```",
      "more text",
      "```patch",
      "--- a/two.tex",
      "+++ b/two.tex",
      "```",
    ].join("\n");

    const patch = extractPatch(text);
    expect(patch).toContain("one.tex");
    expect(patch).toContain("two.tex");
    expect(patch?.split("\n\n").length).toBe(2);
  });
});
