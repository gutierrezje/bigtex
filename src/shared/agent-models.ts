import type { AgentProviderGroup, AgentSessionConfig } from "./domain";

/** Highest reasoning effort first; unknown variants sort alphabetically after these. */
const REASONING_LEVEL_ORDER = [
  "xhigh",
  "max",
  "high",
  "medium",
  "med",
  "low",
  "min",
  "none",
  "thinking",
  "reasoning",
] as const;

const HIDDEN_VARIANTS = new Set(["default"]);

/** Candidate suffixes probed via ACP when OpenCode omits variant metadata. */
/** Fallback when OpenCode serve providers API is unavailable. */
export const REASONING_VARIANT_PROBE_CANDIDATES = [
  "max",
  "xhigh",
  "high",
  "medium",
  "med",
  "low",
  "min",
  "none",
  "thinking",
  "reasoning",
] as const;

function variantRank(variant: string): number {
  const lower = variant.toLowerCase();
  const index = (REASONING_LEVEL_ORDER as readonly string[]).indexOf(lower);
  return index === -1 ? REASONING_LEVEL_ORDER.length : index;
}

export function sortReasoningVariants(variants: string[]): string[] {
  return [...new Set(variants)]
    .filter((variant) => !HIDDEN_VARIANTS.has(variant.toLowerCase()))
    .sort((a, b) => {
      const rank = variantRank(a) - variantRank(b);
      return rank !== 0 ? rank : a.localeCompare(b);
    });
}

export function providerGroupFromModelId(modelId: string): AgentProviderGroup | "other" {
  const provider = modelId.split("/")[0] ?? "";
  if (provider === "opencode-go") return "go";
  if (provider === "opencode") return "free";
  return "other";
}

export function baseModelId(modelId: string): string {
  const parts = modelId.split("/");
  if (parts.length >= 3) return parts.slice(0, 2).join("/");
  return modelId;
}

export function pickDefaultModel(config: AgentSessionConfig, group: AgentProviderGroup): string {
  const inGroup = config.models.filter((model) => model.providerGroup === group && !model.variant);
  const preferred =
    group === "free"
      ? inGroup.find((model) => model.id.includes("deepseek-v4-flash-free"))
      : inGroup.find((model) => model.id.includes("glm-5"));
  return preferred?.id ?? inGroup[0]?.id ?? config.currentModelId;
}

export function reasoningVariantsForModel(config: AgentSessionConfig, modelId: string): string[] {
  const base = baseModelId(modelId);
  const fromProbe = config.variantsByModel[base] ?? [];
  const fromOptions = config.models
    .filter((model) => model.id.startsWith(`${base}/`))
    .map((model) => model.variant)
    .filter((variant): variant is string => Boolean(variant));

  const merged =
    baseModelId(config.currentModelId) === base
      ? [...fromProbe, ...fromOptions, ...config.availableVariants]
      : [...fromProbe, ...fromOptions];

  return sortReasoningVariants(merged);
}

export function modelSupportsReasoning(config: AgentSessionConfig, modelId: string): boolean {
  return reasoningVariantsForModel(config, modelId).length > 0;
}

export function normalizeReasoningLevel(
  config: AgentSessionConfig,
  modelId: string,
  level: string | null,
): string | null {
  if (!level) return null;
  const variants = reasoningVariantsForModel(config, modelId);
  return variants.includes(level) ? level : null;
}

export function withModelVariants(
  config: AgentSessionConfig,
  modelId: string,
  variants: string[],
): AgentSessionConfig {
  const base = baseModelId(modelId);
  return {
    ...config,
    variantsByModel: {
      ...config.variantsByModel,
      [base]: sortReasoningVariants(variants),
    },
  };
}
