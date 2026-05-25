import { useCallback, useRef, useState } from "react";
import {
  formatAgentModelLabel,
  formatProviderGroupLabel,
  formatReasoningVariant,
} from "../../../../shared/agent-display-labels";
import {
  AGENT_PROVIDER_GROUPS,
  modelSupportsReasoning,
  reasoningVariantsForModel,
} from "../../../../shared/agent-models";
import { useDismissOnPointerDown } from "../../hooks/useDismissOnPointerDown";
import { TREE_LABEL_CLASS } from "../../lib/treeTypography";
import { useAppStore } from "../../store";
import { AgentModelIcon, AgentProviderIcon } from "./AgentBrandIcon";

const TOOLBAR_TRIGGER_BASE = `flex items-center gap-1 rounded-md border border-border/60 bg-transparent px-2 py-0.5 ${TREE_LABEL_CLASS} transition-all duration-100 hover:border-accent/30 hover:bg-surface-raised/40 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer`;

function toolbarTriggerClass(active: boolean, muted = false): string {
  if (active) {
    return `${TOOLBAR_TRIGGER_BASE} border-accent/25 bg-accent/8 text-text-primary`;
  }
  return `${TOOLBAR_TRIGGER_BASE} ${muted ? "text-text-muted" : "text-text-primary"}`;
}

function ChevronDown() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-2.5 w-2.5 text-text-muted"
      aria-hidden
    >
      <title>Expand</title>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function AgentModelToolbar() {
  const agentSettings = useAppStore((state) => state.agentSettings);
  const setAgentProviderGroup = useAppStore((state) => state.setAgentProviderGroup);
  const setAgentModelId = useAppStore((state) => state.setAgentModelId);
  const setAgentReasoningLevel = useAppStore((state) => state.setAgentReasoningLevel);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showReasoningDropdown, setShowReasoningDropdown] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const reasoningMenuRef = useRef<HTMLDivElement>(null);

  const closeAllDropdowns = useCallback(() => {
    setShowProviderDropdown(false);
    setShowModelDropdown(false);
    setShowReasoningDropdown(false);
  }, []);

  useDismissOnPointerDown(showProviderDropdown, closeAllDropdowns, providerMenuRef);
  useDismissOnPointerDown(showModelDropdown, closeAllDropdowns, modelMenuRef);
  useDismissOnPointerDown(showReasoningDropdown, closeAllDropdowns, reasoningMenuRef);

  const { config, providerGroup, modelId, reasoningLevel, reasoningProbing, loading, error } =
    agentSettings;
  const modelsForGroup =
    config?.models.filter(
      (model) => model.providerGroup === providerGroup && model.variant === null,
    ) ?? [];
  const selectedModel = modelsForGroup.find((model) => model.id === modelId) ?? modelsForGroup[0];
  const reasoningVariants = config ? reasoningVariantsForModel(config, modelId) : [];
  const reasoningAvailable = config ? modelSupportsReasoning(config, modelId) : false;

  if (loading)
    return (
      <p className={`px-1 pb-2 ${TREE_LABEL_CLASS} text-text-muted`}>Loading OpenCode models…</p>
    );

  const reasoningOptions: Array<{ value: string | null; label: string }> = [
    { value: null, label: "Off" },
    ...reasoningVariants.map((variant) => ({
      value: variant,
      label: formatReasoningVariant(variant),
    })),
  ];

  return (
    <div className="flex flex-col gap-1 px-1 pb-2">
      {error ? <p className={`m-0 ${TREE_LABEL_CLASS} text-danger`}>{error}</p> : null}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <div className="relative" ref={providerMenuRef}>
          <button
            type="button"
            disabled={!config}
            title="Choose AI provider"
            className={toolbarTriggerClass(false)}
            onClick={() => {
              setShowModelDropdown(false);
              setShowReasoningDropdown(false);
              setShowProviderDropdown((open) => !open);
            }}
          >
            <AgentProviderIcon group={providerGroup} />
            <span className="max-w-[120px] truncate">
              {formatProviderGroupLabel(providerGroup)}
            </span>
            <ChevronDown />
          </button>
          {showProviderDropdown ? (
            <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[9.5rem] rounded border border-border bg-surface-raised p-1 shadow-xl">
              {AGENT_PROVIDER_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${TREE_LABEL_CLASS} transition-all cursor-pointer ${providerGroup === group ? "bg-accent/8 text-accent border border-accent/15" : "text-text-secondary hover:bg-surface-raised/60 hover:text-text-primary"}`}
                  onClick={() => {
                    setAgentProviderGroup(group);
                    setShowProviderDropdown(false);
                  }}
                >
                  <AgentProviderIcon group={group} />
                  <span className="min-w-0 truncate">{formatProviderGroupLabel(group)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative" ref={modelMenuRef}>
          <button
            type="button"
            disabled={!config || modelsForGroup.length === 0}
            title="Choose model"
            className={toolbarTriggerClass(false)}
            onClick={() => {
              setShowProviderDropdown(false);
              setShowReasoningDropdown(false);
              setShowModelDropdown((open) => !open);
            }}
          >
            {selectedModel ? <AgentModelIcon modelId={selectedModel.id} /> : null}
            <span className="max-w-[140px] truncate">
              {selectedModel ? formatAgentModelLabel(selectedModel) : "Model"}
            </span>
            <ChevronDown />
          </button>
          {showModelDropdown ? (
            <div className="absolute bottom-full left-0 z-50 mb-1.5 max-h-48 w-52 overflow-y-auto rounded border border-border bg-surface-raised p-1 shadow-xl">
              {modelsForGroup.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${TREE_LABEL_CLASS} transition-all cursor-pointer ${model.id === modelId ? "bg-accent/8 text-accent border border-accent/15" : "text-text-secondary hover:bg-surface-raised/60 hover:text-text-primary"}`}
                  onClick={() => {
                    setAgentModelId(model.id);
                    setShowModelDropdown(false);
                  }}
                >
                  <AgentModelIcon modelId={model.id} />
                  <span className="min-w-0 truncate">{formatAgentModelLabel(model)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mx-0.5 h-3 w-px shrink-0 bg-border/60" />
        <div className="relative" ref={reasoningMenuRef}>
          <button
            type="button"
            disabled={!reasoningAvailable || reasoningProbing}
            title={
              reasoningProbing
                ? "Loading reasoning levels…"
                : reasoningAvailable
                  ? "Reasoning effort (max → low); off uses the base model"
                  : "No reasoning variants for this model"
            }
            className={toolbarTriggerClass(Boolean(reasoningLevel), !reasoningLevel)}
            onClick={() => {
              setShowProviderDropdown(false);
              setShowModelDropdown(false);
              setShowReasoningDropdown((open) => !open);
            }}
          >
            <span>
              {reasoningProbing
                ? "…"
                : reasoningLevel
                  ? formatReasoningVariant(reasoningLevel)
                  : "Off"}
            </span>
            <ChevronDown />
          </button>
          {showReasoningDropdown ? (
            <div className="absolute bottom-full left-0 z-50 mb-1.5 min-w-[5.5rem] rounded border border-border bg-surface-raised p-1 shadow-xl">
              {reasoningOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`w-full rounded px-2 py-1 text-left ${TREE_LABEL_CLASS} transition-all cursor-pointer ${reasoningLevel === option.value ? "bg-accent/8 text-accent border border-accent/15" : "text-text-secondary hover:bg-surface-raised/60 hover:text-text-primary"}`}
                  onClick={() => {
                    setAgentReasoningLevel(option.value);
                    setShowReasoningDropdown(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
