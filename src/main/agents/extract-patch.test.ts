import { describe, expect, it } from "vitest";
import { extractPatch } from "./extract-patch";

describe("extractPatch", () => {
  it("collects fenced diff/patch blocks and ignores plain text", () => {
    expect(extractPatch("plain assistant reply")).toBeNull();

    const single = "Apply this:\n```diff\n--- a/main.tex\n+++ b/main.tex\n```";
    expect(extractPatch(single)).toContain("--- a/main.tex");

    const multi = [
      "```diff",
      "--- a/one.tex",
      "+++ b/one.tex",
      "```",
      "```patch",
      "--- a/two.tex",
      "+++ b/two.tex",
      "```",
    ].join("\n");

    const patch = extractPatch(multi);
    expect(patch).toContain("one.tex");
    expect(patch).toContain("two.tex");
    expect(patch?.split("\n\n").length).toBe(2);
  });
});
