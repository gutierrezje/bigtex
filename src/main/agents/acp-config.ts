import {
  baseModelId,
  filterAgentModels,
  normalizeReasoningLevel,
  providerGroupFromModelId,
} from "../../shared/agent-models";
import type { AgentModelOption, AgentSessionConfig } from "../../shared/domain";

interface AcpSelectOption {
  value: string;
  name: string;
}

interface AcpConfigOption {
  id: string;
  currentValue?: string;
  options?: AcpSelectOption[];
  _meta?: {
    opencode?: {
      modelId?: string;
      variant?: string | null;
      availableVariants?: string[];
    };
  };
}

interface AcpSessionNewResult {
  sessionId: string;
  configOptions?: AcpConfigOption[];
  models?: {
    currentModelId?: string;
    availableModels?: Array<{ modelId: string; name: string }>;
  };
  _meta?: AcpConfigOption["_meta"];
}

interface AcpSetConfigOptionResult {
  configOptions?: AcpConfigOption[];
}

function variantFromModelId(modelId: string): string | null {
  const parts = modelId.split("/");
  if (parts.length >= 3) return parts.slice(2).join("/");
  return null;
}

function labelForModel(modelId: string, displayName: string): string {
  const parts = modelId.split("/");
  return parts.length >= 2 ? parts[parts.length - 1] : displayName;
}

function buildModelOption(modelId: string, name: string): AgentModelOption | null {
  const group = providerGroupFromModelId(modelId);
  if (group === "other") return null;
  return {
    id: modelId,
    name: labelForModel(modelId, name),
    label: name,
    providerGroup: group,
    variant: variantFromModelId(modelId),
  };
}

function parseFromConfigOptions(
  configOptions: AcpConfigOption[] | undefined,
  fallbackMeta?: AcpConfigOption["_meta"],
): AgentSessionConfig {
  const modelOption = configOptions?.find((option) => option.id === "model");
  const currentModelId = modelOption?.currentValue ?? "";
  const models = filterAgentModels(
    (modelOption?.options ?? [])
      .map((option) => buildModelOption(option.value, option.name))
      .filter((model): model is AgentModelOption => model !== null),
  );
  const meta = modelOption?._meta?.opencode ?? fallbackMeta?.opencode;
  const availableVariants = meta?.availableVariants ?? [];

  return {
    models,
    currentModelId,
    availableVariants,
    currentVariant: meta?.variant ?? variantFromModelId(currentModelId),
    variantsByModel: {},
  };
}

export function parseAgentSessionConfig(result: AcpSessionNewResult): AgentSessionConfig {
  if (result.configOptions) {
    return parseFromConfigOptions(result.configOptions, result._meta);
  }

  const legacy = result.models;
  const currentModelId = legacy?.currentModelId ?? "";
  const models = filterAgentModels(
    (legacy?.availableModels ?? [])
      .map((model) => buildModelOption(model.modelId, model.name))
      .filter((model): model is AgentModelOption => model !== null),
  );

  return {
    models,
    currentModelId,
    availableVariants: result._meta?.opencode?.availableVariants ?? [],
    currentVariant: result._meta?.opencode?.variant ?? variantFromModelId(currentModelId),
    variantsByModel: {},
  };
}

export function mergeAgentSessionConfig(
  base: AgentSessionConfig,
  update: AcpSetConfigOptionResult,
): AgentSessionConfig {
  if (!update.configOptions) return base;

  const refreshed = parseFromConfigOptions(update.configOptions);
  const modelsById = new Map(filterAgentModels(base.models).map((model) => [model.id, model]));
  for (const model of refreshed.models) {
    modelsById.set(model.id, model);
  }

  return {
    ...refreshed,
    models: filterAgentModels([...modelsById.values()]),
    availableVariants:
      refreshed.availableVariants.length > 0 ? refreshed.availableVariants : base.availableVariants,
    variantsByModel: base.variantsByModel,
  };
}

export {
  normalizeReasoningLevel,
  pickDefaultModel,
  reasoningVariantsForModel,
} from "../../shared/agent-models";

export function resolveModelIdForRun(
  config: AgentSessionConfig,
  modelId: string,
  reasoningLevel: string | null,
): string {
  const base = baseModelId(modelId);
  const level = normalizeReasoningLevel(config, base, reasoningLevel);
  if (!level) return base;

  const explicit = config.models.find((model) => model.id === `${base}/${level}`);
  return explicit?.id ?? `${base}/${level}`;
}

export type { AcpSessionNewResult, AcpSetConfigOptionResult };
