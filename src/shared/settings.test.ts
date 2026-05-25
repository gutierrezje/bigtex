import { describe, expect, it } from "vitest";
import type { AgentSessionConfig } from "./domain";
import {
  defaultSettingsFile,
  mergeEffectiveSettings,
  normalizeProjectRootKey,
  reconcileAgentModelPreference,
} from "./settings";

const sampleConfig: AgentSessionConfig = {
  models: [
    {
      id: "opencode/test-model",
      name: "test-model",
      label: "Test",
      providerGroup: "free",
      variant: null,
    },
    {
      id: "opencode-go/glm-5",
      name: "glm-5",
      label: "GLM 5",
      providerGroup: "go",
      variant: null,
    },
  ],
  currentModelId: "opencode/test-model",
  availableVariants: [],
  currentVariant: null,
  variantsByModel: {},
};

describe("settings", () => {
  it("normalizes project root keys", () => {
    expect(normalizeProjectRootKey("/tmp/proj/")).toBe("/tmp/proj");
  });

  it("merges workspace agent model over user default", () => {
    const file = defaultSettingsFile();
    file.user.agentModel = {
      providerGroup: "free",
      modelId: "opencode/test-model",
      reasoningLevel: null,
    };
    const root = "/tmp/thesis";
    file.workspaces[normalizeProjectRootKey(root)] = {
      agentModel: {
        providerGroup: "go",
        modelId: "opencode-go/glm-5",
        reasoningLevel: "high",
      },
    };

    const effective = mergeEffectiveSettings(file, root);
    expect(effective.agentModel?.providerGroup).toBe("go");
    expect(effective.agentModel?.modelId).toBe("opencode-go/glm-5");
    expect(effective.agentPermissionMode).toBe("ask");
  });

  it("reconciles missing workspace model against catalog", () => {
    const reconciled = reconcileAgentModelPreference(
      {
        providerGroup: "go",
        modelId: "opencode-go/missing",
        reasoningLevel: "high",
      },
      sampleConfig,
    );
    expect(reconciled.modelId).toBe("opencode-go/glm-5");
    expect(reconciled.reasoningLevel).toBeNull();
  });
});
