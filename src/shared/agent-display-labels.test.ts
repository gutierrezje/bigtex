import { describe, expect, it } from "vitest";
import {
  formatAgentModelLabel,
  formatModelSlug,
  formatProviderGroupLabel,
  formatReasoningVariant,
  isSlugLike,
  stripProviderPrefixFromLabel,
} from "./agent-display-labels";

describe("formatModelSlug", () => {
  it("formats versioned model slugs", () => {
    expect(formatModelSlug("deepseek-v4-pro")).toBe("DeepSeek V4 Pro");
    expect(formatModelSlug("deepseek-v4-flash-free")).toBe("DeepSeek V4 Flash Free");
  });

  it("formats glm slugs", () => {
    expect(formatModelSlug("glm-5")).toBe("GLM 5");
  });
});

describe("formatAgentModelLabel", () => {
  it("prefers upstream label when human-readable", () => {
    expect(
      formatAgentModelLabel({
        id: "opencode/deepseek-v4-flash-free",
        name: "deepseek-v4-flash-free",
        label: "DeepSeek",
        providerGroup: "free",
      }),
    ).toBe("DeepSeek");
  });

  it("strips provider prefix from copilot model labels", () => {
    expect(
      formatAgentModelLabel({
        id: "github-copilot/gpt-4.1",
        name: "gpt-4.1",
        label: "GitHub Copilot/GPT-4.1",
        providerGroup: "copilot",
      }),
    ).toBe("GPT-4.1");
    expect(stripProviderPrefixFromLabel("GitHub Copilot/Claude Sonnet 4", "copilot")).toBe(
      "Claude Sonnet 4",
    );
  });

  it("strips opencode prefix from zen model labels", () => {
    expect(
      formatAgentModelLabel({
        id: "opencode/deepseek-v4-flash-free",
        name: "deepseek-v4-flash-free",
        label: "OpenCode/DeepSeek V4 Flash Free",
        providerGroup: "free",
      }),
    ).toBe("DeepSeek V4 Flash Free");
  });

  it("formats slug when label matches slug", () => {
    expect(
      formatAgentModelLabel({
        id: "opencode-go/deepseek-v4-pro",
        name: "deepseek-v4-pro",
        label: "deepseek-v4-pro",
        providerGroup: "go",
      }),
    ).toBe("DeepSeek V4 Pro");
  });
});

describe("formatProviderGroupLabel", () => {
  it("names provider groups by vendor", () => {
    expect(formatProviderGroupLabel("free")).toBe("OpenCode");
    expect(formatProviderGroupLabel("go")).toBe("OpenCode Go");
    expect(formatProviderGroupLabel("copilot")).toBe("GitHub Copilot");
  });
});

describe("formatReasoningVariant", () => {
  it("uses known reasoning labels", () => {
    expect(formatReasoningVariant("xhigh")).toBe("X-High");
    expect(formatReasoningVariant("med")).toBe("Med");
  });
});

describe("isSlugLike", () => {
  it("detects kebab slugs", () => {
    expect(isSlugLike("deepseek-v4-pro")).toBe(true);
    expect(isSlugLike("DeepSeek V4 Pro")).toBe(false);
  });
});
