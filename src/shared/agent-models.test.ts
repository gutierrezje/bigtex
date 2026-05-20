import { describe, expect, it } from "vitest";
import {
  baseModelId,
  normalizeReasoningLevel,
  pickDefaultModel,
  reasoningVariantsForModel,
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

describe("sortReasoningVariants", () => {
  it("orders known reasoning levels and hides default", () => {
    expect(sortReasoningVariants(["low", "xhigh", "default", "high"])).toEqual([
      "xhigh",
      "high",
      "low",
    ]);
  });
});

describe("baseModelId", () => {
  it("strips variant suffix from model ids", () => {
    expect(baseModelId("opencode/foo/bar")).toBe("opencode/foo");
    expect(baseModelId("opencode/foo")).toBe("opencode/foo");
  });
});

describe("pickDefaultModel", () => {
  it("prefers deepseek flash for free group", () => {
    const config = sessionConfig();
    expect(pickDefaultModel(config, "free")).toBe("opencode/deepseek-v4-flash-free");
  });

  it("prefers glm-5 for go group", () => {
    const config = sessionConfig();
    expect(pickDefaultModel(config, "go")).toBe("opencode-go/glm-5");
  });
});

describe("reasoningVariantsForModel", () => {
  it("merges probe, model options, and available variants for current base", () => {
    const config = sessionConfig({
      variantsByModel: { "opencode/deepseek-v4-flash-free": ["xhigh"] },
    });
    expect(reasoningVariantsForModel(config, "opencode/deepseek-v4-flash-free")).toEqual([
      "xhigh",
      "high",
      "med",
    ]);
  });
});

describe("normalizeReasoningLevel", () => {
  it("returns null for unknown levels", () => {
    const config = sessionConfig({
      variantsByModel: { "opencode/deepseek-v4-flash-free": ["high"] },
    });
    expect(normalizeReasoningLevel(config, "opencode/deepseek-v4-flash-free", "nope")).toBeNull();
  });

  it("keeps valid levels", () => {
    const config = sessionConfig({
      variantsByModel: { "opencode/deepseek-v4-flash-free": ["high"] },
    });
    expect(normalizeReasoningLevel(config, "opencode/deepseek-v4-flash-free", "high")).toBe("high");
  });
});

describe("withModelVariants", () => {
  it("stores sorted variants by base model id", () => {
    const config = sessionConfig();
    const updated = withModelVariants(config, "opencode/deepseek-v4-flash-free", ["low", "xhigh"]);
    expect(updated.variantsByModel["opencode/deepseek-v4-flash-free"]).toEqual(["xhigh", "low"]);
  });
});
