import { ModelIcon, ModelProvider, ProviderIcon } from "@lobehub/icons";
import type { AgentProviderGroup } from "../../../../shared/domain";

const PROVIDER_GROUP_LOBE_KEY: Record<AgentProviderGroup, string> = {
  free: ModelProvider.OpenCode,
  go: ModelProvider.OpenCodeGo,
  copilot: ModelProvider.GithubCopilot,
};

const ICON_CLASS = "shrink-0 opacity-90";

interface AgentBrandIconProps {
  size?: number;
  className?: string;
}

export function AgentProviderIcon({
  group,
  size = 14,
  className,
}: AgentBrandIconProps & { group: AgentProviderGroup }) {
  return (
    <ProviderIcon
      provider={PROVIDER_GROUP_LOBE_KEY[group]}
      size={size}
      type="mono"
      className={className ? `${ICON_CLASS} ${className}` : ICON_CLASS}
    />
  );
}

export function AgentModelIcon({
  modelId,
  size = 14,
  className,
}: AgentBrandIconProps & { modelId: string }) {
  return (
    <ModelIcon
      model={modelId}
      size={size}
      type="mono"
      className={className ? `${ICON_CLASS} ${className}` : ICON_CLASS}
    />
  );
}
