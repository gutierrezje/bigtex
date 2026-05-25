import {
  baseModelId,
  normalizeReasoningLevel,
  pickDefaultModel,
  resolveAgentUiSelection,
} from "./agent-models";
import type { AgentProviderGroup, AgentSessionConfig } from "./domain";

export const SETTINGS_FILE_VERSION = 1 as const;

export type AgentPermissionMode = "ask" | "auto-approve";
export type PatchApplyMode = "review" | "auto";

export interface AgentModelPreference {
  providerGroup: AgentProviderGroup;
  modelId: string;
  reasoningLevel: string | null;
}

export interface UserSettings {
  agentPermissionMode: AgentPermissionMode;
  patchApplyMode: PatchApplyMode;
  agentModel: AgentModelPreference | null;
  pdfPreviewInverted: boolean;
}

export interface WorkspaceSettings {
  agentModel?: AgentModelPreference;
}

export interface SettingsFile {
  version: typeof SETTINGS_FILE_VERSION;
  user: UserSettings;
  workspaces: Record<string, WorkspaceSettings>;
}

export interface EffectiveSettings {
  agentPermissionMode: AgentPermissionMode;
  patchApplyMode: PatchApplyMode;
  agentModel: AgentModelPreference | null;
  pdfPreviewInverted: boolean;
}

export interface AgentPermissionOption {
  optionId: string;
  kind?: string;
  name?: string;
}

export interface AgentPermissionRequestPayload {
  runId: string;
  requestId: string;
  title: string;
  options: AgentPermissionOption[];
  queueIndex: number;
  queueTotal: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  agentPermissionMode: "ask",
  patchApplyMode: "review",
  agentModel: null,
  pdfPreviewInverted: true,
};

export function defaultSettingsFile(): SettingsFile {
  return {
    version: SETTINGS_FILE_VERSION,
    user: { ...DEFAULT_USER_SETTINGS },
    workspaces: {},
  };
}

export function normalizeProjectRootKey(rootPath: string): string {
  return rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function mergeEffectiveSettings(
  file: SettingsFile,
  rootPath: string | null,
): EffectiveSettings {
  const workspace =
    rootPath != null ? file.workspaces[normalizeProjectRootKey(rootPath)] : undefined;
  const agentModel = workspace?.agentModel ?? file.user.agentModel ?? null;

  return {
    agentPermissionMode: file.user.agentPermissionMode,
    patchApplyMode: file.user.patchApplyMode,
    agentModel,
    pdfPreviewInverted: file.user.pdfPreviewInverted,
  };
}

export function reconcileAgentModelPreference(
  preference: AgentModelPreference | null,
  config: AgentSessionConfig,
): AgentModelPreference {
  if (!preference) {
    const { providerGroup, modelId } = resolveAgentUiSelection(config);
    return {
      providerGroup,
      modelId,
      reasoningLevel: normalizeReasoningLevel(config, modelId, config.currentVariant),
    };
  }

  const base = baseModelId(preference.modelId);
  const inCatalog = config.models.some((model) => model.id === base && model.variant === null);
  const groupModels = config.models.filter(
    (model) => model.providerGroup === preference.providerGroup && model.variant === null,
  );

  let modelId = base;
  let providerGroup = preference.providerGroup;

  if (!inCatalog) {
    if (groupModels.length > 0) {
      modelId = pickDefaultModel(config, preference.providerGroup);
    } else {
      const fallback = resolveAgentUiSelection(config);
      providerGroup = fallback.providerGroup;
      modelId = fallback.modelId;
    }
  }

  return {
    providerGroup,
    modelId,
    reasoningLevel: normalizeReasoningLevel(config, modelId, preference.reasoningLevel),
  };
}

export function pickAllowPermissionOption(
  options: AgentPermissionOption[],
): AgentPermissionOption | undefined {
  return (
    options.find((option) => option.kind?.startsWith("allow")) ??
    options.find((option) => option.optionId === "once") ??
    options[0]
  );
}

export function pickDenyPermissionOption(
  options: AgentPermissionOption[],
): AgentPermissionOption | undefined {
  return (
    options.find((option) => option.kind === "reject" || option.kind === "deny") ??
    options.find((option) => option.optionId === "reject" || option.optionId === "deny") ??
    undefined
  );
}

export function permissionRequestTitle(params: {
  options?: AgentPermissionOption[];
  toolName?: string;
  path?: string;
}): string {
  if (params.path) return `Allow access to ${params.path}?`;
  if (params.toolName) return `Allow ${params.toolName}?`;
  const writeOption = params.options?.find((option) => option.kind?.includes("write"));
  if (writeOption?.name) return writeOption.name;
  return "Allow this action?";
}
