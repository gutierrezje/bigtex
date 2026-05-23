import { describe, expect, it } from "vitest";
import type { AgentSessionConfig } from "../../shared/domain";
import {
  mergeAgentSessionConfig,
  parseAgentSessionConfig,
  resolveModelIdForRun,
} from "./acp-config";

describe("acp-config", () => {
  it("parses session/new configOptions into AgentSessionConfig", () => {
    const config = parseAgentSessionConfig({
      sessionId: "s1",
      configOptions: [
        {
          id: "model",
          currentValue: "opencode/deepseek-v4-flash-free/high",
          options: [
            { value: "opencode/deepseek-v4-flash-free", name: "DeepSeek" },
            { value: "opencode-go/glm-5", name: "GLM 5" },
          ],
          _meta: {
            opencode: {
              variant: "high",
              availableVariants: ["high", "low"],
            },
          },
        },
      ],
    });

    expect(config.currentModelId).toBe("opencode/deepseek-v4-flash-free/high");
    expect(config.models).toHaveLength(2);
    expect(config.availableVariants).toEqual(["high", "low"]);
    expect(config.currentVariant).toBe("high");
  });

  it("merges updates without dropping probed variants", () => {
    const base: AgentSessionConfig = {
      models: [{ id: "opencode/a", name: "a", label: "A", providerGroup: "free", variant: null }],
      currentModelId: "opencode/a",
      availableVariants: [],
      currentVariant: null,
      variantsByModel: { "opencode/a": ["high"] },
    };

    const merged = mergeAgentSessionConfig(base, {
      configOptions: [
        {
          id: "model",
          currentValue: "opencode/b",
          options: [{ value: "opencode/b", name: "B" }],
        },
      ],
    });

    expect(merged.currentModelId).toBe("opencode/b");
    expect(merged.models.map((model) => model.id).sort()).toEqual(["opencode/a", "opencode/b"]);
    expect(merged.variantsByModel).toEqual(base.variantsByModel);
  });

  it("includes copilot providers and drops unknown providers", () => {
    const config = parseAgentSessionConfig({
      sessionId: "s1",
      configOptions: [
        {
          id: "model",
          currentValue: "opencode/deepseek-v4-flash-free",
          options: [
            { value: "opencode/deepseek-v4-flash-free", name: "DeepSeek" },
            { value: "github-copilot/gpt-4o", name: "GitHub Copilot" },
            { value: "gh-copilot/claude-sonnet", name: "GH Copilot" },
            { value: "anthropic/claude-sonnet", name: "Anthropic" },
          ],
        },
      ],
    });

    expect(config.models.map((model) => model.id).sort()).toEqual([
      "gh-copilot/claude-sonnet",
      "github-copilot/gpt-4o",
      "opencode/deepseek-v4-flash-free",
    ]);
    expect(config.models.find((model) => model.id === "github-copilot/gpt-4o")?.providerGroup).toBe(
      "copilot",
    );
  });

  it("builds concrete model ids for reasoning runs", () => {
    const config: AgentSessionConfig = {
      models: [
        { id: "opencode/foo", name: "foo", label: "Foo", providerGroup: "free", variant: null },
      ],
      currentModelId: "opencode/foo",
      availableVariants: [],
      currentVariant: null,
      variantsByModel: { "opencode/foo": ["high"] },
    };

    expect(resolveModelIdForRun(config, "opencode/foo", "high")).toBe("opencode/foo/high");
  });
});
