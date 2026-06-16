import { describe, expect, it } from "vitest";
import { parseServeProvidersConfig } from "./opencode-serve";

describe("opencode serve config", () => {
  it("parses supported providers into AgentSessionConfig", () => {
    const config = parseServeProvidersConfig({
      providers: [
        {
          id: "opencode",
          models: {
            "deepseek-v4-flash-free": {
              name: "DeepSeek V4 Flash",
              variants: { default: {}, high: {}, low: {} },
            },
          },
        },
        {
          id: "opencode-go",
          models: {
            "glm-5": {
              name: "GLM 5",
              variants: { xhigh: {}, medium: {} },
            },
          },
        },
        {
          id: "anthropic",
          models: {
            "claude-sonnet": { name: "Claude Sonnet" },
          },
        },
      ],
      default: { opencode: "deepseek-v4-flash-free" },
    });

    expect(config.currentModelId).toBe("opencode/deepseek-v4-flash-free");
    expect(config.models.map((model) => model.id).sort()).toEqual([
      "opencode-go/glm-5",
      "opencode/deepseek-v4-flash-free",
    ]);
    expect(config.models.find((model) => model.id === "opencode-go/glm-5")?.providerGroup).toBe(
      "go",
    );
    expect(config.variantsByModel["opencode/deepseek-v4-flash-free"]).toEqual(["high", "low"]);
    expect(config.variantsByModel["opencode-go/glm-5"]).toEqual(["xhigh", "medium"]);
  });

  it("falls back to the first supported model when defaults are unsupported", () => {
    const config = parseServeProvidersConfig({
      providers: [
        {
          id: "opencode-go",
          models: {
            "glm-5": { name: "GLM 5" },
          },
        },
      ],
      default: { anthropic: "claude-sonnet" },
    });

    expect(config.currentModelId).toBe("opencode-go/glm-5");
  });
});
