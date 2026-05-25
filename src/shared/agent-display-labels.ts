import type { AgentModelOption, AgentProviderGroup } from "./domain";

/** UI labels for provider toggles (ids stay `free` / `go` / `copilot` for logic). */
export const PROVIDER_GROUP_LABELS: Record<AgentProviderGroup, string> = {
  free: "OpenCode",
  go: "OpenCode Go",
  copilot: "GitHub Copilot",
};

/** Prefixes OpenCode may embed in model display names — stripped in the model picker. */
const MODEL_LABEL_PREFIXES: Record<AgentProviderGroup, readonly string[]> = {
  free: ["OpenCode Zen", "OpenCode Free", "OpenCode"],
  go: ["OpenCode Go"],
  copilot: ["GitHub Copilot", "GH Copilot", "Copilot"],
};

/** Brand tokens in model slugs — keep short; unknown tokens use title case. */
const BRAND_TOKENS: Record<string, string> = {
  deepseek: "DeepSeek",
  glm: "GLM",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  meta: "Meta",
  llama: "LLaMA",
  mistral: "Mistral",
  qwen: "Qwen",
  claude: "Claude",
  gemini: "Gemini",
  grok: "Grok",
  opencode: "OpenCode",
};

const REASONING_VARIANT_LABELS: Record<string, string> = {
  xhigh: "X-High",
  max: "Max",
  high: "High",
  medium: "Medium",
  med: "Med",
  low: "Low",
  min: "Min",
  none: "None",
  thinking: "Thinking",
  reasoning: "Reasoning",
};

const SLUG_LIKE = /^[a-z0-9]+([._-][a-z0-9]+)*$/;

export function isSlugLike(value: string): boolean {
  return SLUG_LIKE.test(value.trim());
}

export function modelIdTail(modelId: string): string {
  const parts = modelId.split("/").filter(Boolean);
  return parts.length >= 2 ? (parts[parts.length - 1] ?? modelId) : modelId;
}

function formatToken(token: string): string {
  const lower = token.toLowerCase();
  const brand = BRAND_TOKENS[lower];
  if (brand) return brand;
  if (/^v\d+(\.\d+)?$/i.test(lower)) return `V${lower.slice(1)}`;
  if (/^\d+(\.\d+)?$/.test(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Turn a model slug (`deepseek-v4-pro`) into display text (`DeepSeek V4 Pro`). */
export function formatModelSlug(slug: string): string {
  return slug.split(/[-_]+/).filter(Boolean).map(formatToken).join(" ");
}

export function formatProviderGroupLabel(group: AgentProviderGroup): string {
  return PROVIDER_GROUP_LABELS[group];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove provider branding duplicated by the provider control. */
export function stripProviderPrefixFromLabel(label: string, group: AgentProviderGroup): string {
  let text = label.trim();
  if (!text) return text;

  for (const prefix of MODEL_LABEL_PREFIXES[group]) {
    const pattern = new RegExp(`^${escapeRegExp(prefix)}\\s*(?:/\\s*)?`, "i");
    if (pattern.test(text)) {
      text = text.replace(pattern, "").trim();
      break;
    }
  }

  const slash = text.indexOf("/");
  if (slash > 0) {
    const head = text.slice(0, slash).toLowerCase();
    if (head.includes("copilot") || head.includes("github") || head.includes("opencode")) {
      text = text.slice(slash + 1).trim();
    }
  }

  return text;
}

/**
 * Prefer OpenCode's human label when it is not just the slug; otherwise format the id tail.
 * Strips provider prefixes so the picker does not repeat the provider name.
 */
export function formatAgentModelLabel(
  model: Pick<AgentModelOption, "id" | "name" | "label" | "providerGroup">,
): string {
  const slug = model.name.trim() || modelIdTail(model.id);
  const rawLabel = model.label.trim();
  if (rawLabel && rawLabel !== slug && !isSlugLike(rawLabel)) {
    const stripped = stripProviderPrefixFromLabel(rawLabel, model.providerGroup);
    if (stripped) return stripped;
  }
  return formatModelSlug(slug);
}

export function formatReasoningVariant(variant: string): string {
  const lower = variant.toLowerCase();
  return REASONING_VARIANT_LABELS[lower] ?? formatModelSlug(variant);
}
