import { describe, expect, it } from "vitest";
import {
  baseModelId,
  isSupportedAgentModelId,
  normalizeReasoningLevel,
  pickDefaultModel,
  reasoningVariantsForModel,
  resolveAgentUiSelection,
  sortReasoningVariants,
  withModelVariants,
} from "./agent-models";
import type { AgentSessionConfig } from "./domain";

function sessionConfig(overrides: Partial<AgentSessionConfig> = {}): AgentSessionConfig {
  return {
    models: [
      {
        id: "opencode/deepseek-v4-flash-free",
        name: "deepseek-v4-flash-free",
        label: "DeepSeek Flash",
        providerGroup: "free",
        variant: null,
      },
      {
        id: "opencode/deepseek-v4-flash-free/high",
        name: "high",
        label: "High",
        providerGroup: "free",
        variant: "high",
      },
      {
        id: "opencode-go/glm-5",
        name: "glm-5",
        label: "GLM 5",
        providerGroup: "go",
        variant: null,
      },
    ],
    currentModelId: "opencode/deepseek-v4-flash-free",
    availableVariants: ["med"],
    currentVariant: null,
    variantsByModel: {},
    ...overrides,
  };
}

describe("agent-models", () => {
  it("recognizes supported providers and resolves UI selection", () => {
    expect(isSupportedAgentModelId("opencode/deepseek-v4-flash-free")).toBe(true);
    expect(isSupportedAgentModelId("github-copilot/gpt-4o")).toBe(true);
    expect(isSupportedAgentModelId("anthropic/claude-sonnet")).toBe(false);

    const withoutCopilot = sessionConfig({ currentModelId: "github-copilot/gpt-4o" });
    expect(resolveAgentUiSelection(withoutCopilot)).toEqual({
      providerGroup: "free",
      modelId: "opencode/deepseek-v4-flash-free",
    });

    const withCopilot = sessionConfig({
      currentModelId: "github-copilot/gpt-4o",
      models: [
        ...sessionConfig().models,
        {
          id: "github-copilot/gpt-4o",
          name: "gpt-4o",
          label: "GPT-4o",
          providerGroup: "copilot",
          variant: null,
        },
      ],
    });
    expect(resolveAgentUiSelection(withCopilot)).toEqual({
      providerGroup: "copilot",
      modelId: "github-copilot/gpt-4o",
    });
  });

  it("normalizes ids, sorts reasoning labels, and picks group defaults", () => {
    expect(baseModelId("opencode/foo/bar")).toBe("opencode/foo");
    expect(sortReasoningVariants(["low", "xhigh", "default", "high"])).toEqual([
      "xhigh",
      "high",
      "low",
    ]);

    const config = sessionConfig();
    expect(pickDefaultModel(config, "free")).toBe("opencode/deepseek-v4-flash-free");
    expect(pickDefaultModel(config, "go")).toBe("opencode-go/glm-5");
  });

  it("merges probe + UI variants and validates reasoning selections", () => {
    const config = sessionConfig({
      variantsByModel: { "opencode/deepseek-v4-flash-free": ["xhigh"] },
    });

    expect(reasoningVariantsForModel(config, "opencode/deepseek-v4-flash-free")).toEqual([
      "xhigh",
      "high",
      "med",
    ]);

    expect(normalizeReasoningLevel(config, "opencode/deepseek-v4-flash-free", "nope")).toBeNull();
    expect(normalizeReasoningLevel(config, "opencode/deepseek-v4-flash-free", "high")).toBe("high");

    const tuned = withModelVariants(config, "opencode/deepseek-v4-flash-free", ["low", "xhigh"]);
    expect(tuned.variantsByModel["opencode/deepseek-v4-flash-free"]).toEqual(["xhigh", "low"]);
  });
});
