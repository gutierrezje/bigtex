import { describe, expect, it } from "vitest";
import { formatWindowChromeLabel } from "./windowChrome";

describe("formatWindowChromeLabel", () => {
  it("shows app name when no project is open", () => {
    expect(formatWindowChromeLabel(null, null)).toBe("BigTeX");
  });

  it("shows project and file when both are set", () => {
    expect(formatWindowChromeLabel("minimal", "main.tex")).toBe("minimal · main.tex");
  });
});
