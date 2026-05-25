import { type ReactNode, useCallback, useEffect, useId } from "react";
import {
  formatAgentModelLabel,
  formatProviderGroupLabel,
  formatReasoningVariant,
} from "../../../shared/agent-display-labels";
import {
  AGENT_PROVIDER_GROUPS,
  modelSupportsReasoning,
  reasoningVariantsForModel,
} from "../../../shared/agent-models";
import type { AgentPermissionMode, PatchApplyMode } from "../../../shared/settings";
import { TREE_LABEL_CLASS } from "../lib/treeTypography";
import { type SettingsCategory, type SettingsScope, useAppStore } from "../store";

const CATEGORIES: Array<{ id: SettingsCategory; label: string }> = [
  { id: "agent", label: "Agent" },
  { id: "pdf", label: "PDF viewer" },
  { id: "general", label: "General" },
];

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-border/30 py-4 last:border-b-0">
      <div>
        <p className={`m-0 text-sm font-medium text-text-primary`}>{label}</p>
        {description ? (
          <p className={`mt-1 mb-0 ${TREE_LABEL_CLASS} text-text-muted`}>{description}</p>
        ) : null}
      </div>
      <div className="w-fit max-w-full">{children}</div>
    </div>
  );
}

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange(value: T): void;
}) {
  return (
    <div className="inline-flex w-fit max-w-full shrink-0 rounded-lg border border-border/50 bg-surface-inset p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 ${TREE_LABEL_CLASS} transition-colors duration-100 cursor-pointer ${
              active
                ? "bg-surface-raised text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function WorkspaceAgentModelSettings() {
  const agentSettings = useAppStore((state) => state.agentSettings);
  const setAgentProviderGroup = useAppStore((state) => state.setAgentProviderGroup);
  const setAgentModelId = useAppStore((state) => state.setAgentModelId);
  const setAgentReasoningLevel = useAppStore((state) => state.setAgentReasoningLevel);

  const { config, providerGroup, modelId, reasoningLevel, loading, error } = agentSettings;
  const modelsForGroup =
    config?.models.filter(
      (model) => model.providerGroup === providerGroup && model.variant === null,
    ) ?? [];
  const reasoningVariants = config ? reasoningVariantsForModel(config, modelId) : [];
  const reasoningAvailable = config ? modelSupportsReasoning(config, modelId) : false;

  if (loading) {
    return <p className={`${TREE_LABEL_CLASS} text-text-muted`}>Loading models…</p>;
  }
  if (error) {
    return <p className={`${TREE_LABEL_CLASS} text-danger`}>{error}</p>;
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className={TREE_LABEL_CLASS}>Provider group</span>
        <select
          className="rounded-lg border border-border/50 bg-surface px-2 py-1.5 text-sm text-text-primary"
          value={providerGroup}
          onChange={(event) => setAgentProviderGroup(event.target.value as typeof providerGroup)}
        >
          {AGENT_PROVIDER_GROUPS.map((group) => (
            <option key={group} value={group}>
              {formatProviderGroupLabel(group)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className={TREE_LABEL_CLASS}>Model</span>
        <select
          className="rounded-lg border border-border/50 bg-surface px-2 py-1.5 text-sm text-text-primary"
          value={modelId}
          onChange={(event) => setAgentModelId(event.target.value)}
        >
          {modelsForGroup.map((model) => (
            <option key={model.id} value={model.id}>
              {formatAgentModelLabel(model)}
            </option>
          ))}
        </select>
      </label>
      {reasoningAvailable ? (
        <label className="grid gap-1">
          <span className={TREE_LABEL_CLASS}>Reasoning</span>
          <select
            className="rounded-lg border border-border/50 bg-surface px-2 py-1.5 text-sm text-text-primary"
            value={reasoningLevel ?? ""}
            onChange={(event) =>
              setAgentReasoningLevel(event.target.value ? event.target.value : null)
            }
          >
            <option value="">Off</option>
            {reasoningVariants.map((variant) => (
              <option key={variant} value={variant}>
                {formatReasoningVariant(variant)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function SettingsOverlay() {
  const titleId = useId();
  const open = useAppStore((state) => state.settingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const scope = useAppStore((state) => state.settingsScope);
  const setSettingsScope = useAppStore((state) => state.setSettingsScope);
  const category = useAppStore((state) => state.settingsCategory);
  const setSettingsCategory = useAppStore((state) => state.setSettingsCategory);
  const project = useAppStore((state) => state.project);
  const effectiveSettings = useAppStore((state) => state.effectiveSettings);
  const updateUserSettingsPatch = useAppStore((state) => state.updateUserSettingsPatch);
  const pdfPreviewInverted = useAppStore((state) => state.pdfPreviewInverted);
  const setPdfPreviewInverted = useAppStore((state) => state.setPdfPreviewInverted);

  const close = useCallback(() => setSettingsOpen(false), [setSettingsOpen]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;

  const workspaceEnabled = project != null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close settings"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative grid h-[min(640px,90vh)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-surface-raised shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold text-text-primary">
            Settings
          </h2>
          <button
            type="button"
            className={`rounded-md border border-border/50 px-2 py-1 ${TREE_LABEL_CLASS} text-text-muted hover:text-text-secondary cursor-pointer`}
            onClick={close}
          >
            Done
          </button>
        </header>

        <div className="grid min-h-0 grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-border/40 bg-surface-inset p-2">
            <div className="mb-2 flex gap-1 rounded-lg border border-border/40 bg-surface p-0.5">
              {(["user", "workspace"] as SettingsScope[]).map((tab) => {
                const active = scope === tab;
                const disabled = tab === "workspace" && !workspaceEnabled;
                const label = tab === "user" ? "User" : "Workspace";
                return (
                  <button
                    key={tab}
                    type="button"
                    disabled={disabled}
                    title={disabled ? "Open a project to edit workspace settings" : undefined}
                    className={`flex-1 rounded-md px-2 py-1 text-center ${TREE_LABEL_CLASS} transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-surface-raised text-text-primary"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                    onClick={() => setSettingsScope(tab)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {CATEGORIES.map((entry) => {
                const active = category === entry.id;
                const disabled = scope === "workspace" && entry.id === "general";
                return (
                  <button
                    key={entry.id}
                    type="button"
                    disabled={disabled}
                    className={`rounded-md px-2.5 py-2 text-left text-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? "bg-accent/10 text-text-primary"
                        : "text-text-secondary hover:bg-surface hover:text-text-primary"
                    }`}
                    onClick={() => setSettingsCategory(entry.id)}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-h-0 overflow-y-auto px-5 py-2">
            {scope === "user" && category === "agent" ? (
              <>
                <SettingsRow
                  label="Permission requests"
                  description="When the assistant needs file access during a run."
                >
                  <SegmentedToggle<AgentPermissionMode>
                    value={effectiveSettings.agentPermissionMode}
                    options={[
                      { value: "ask", label: "Ask" },
                      { value: "auto-approve", label: "Auto-approve" },
                    ]}
                    onChange={(agentPermissionMode) =>
                      void updateUserSettingsPatch({ agentPermissionMode })
                    }
                  />
                </SettingsRow>
                <SettingsRow
                  label="Detected patches"
                  description="Unified diffs extracted from assistant messages."
                >
                  <SegmentedToggle<PatchApplyMode>
                    value={effectiveSettings.patchApplyMode}
                    options={[
                      { value: "review", label: "Review before apply" },
                      { value: "auto", label: "Apply automatically" },
                    ]}
                    onChange={(patchApplyMode) => void updateUserSettingsPatch({ patchApplyMode })}
                  />
                </SettingsRow>
              </>
            ) : null}

            {scope === "workspace" && category === "agent" && workspaceEnabled ? (
              <SettingsRow
                label="Model for this project"
                description="Synced with the agent toolbar. Saved per project root."
              >
                <WorkspaceAgentModelSettings />
              </SettingsRow>
            ) : null}

            {category === "pdf" ? (
              <SettingsRow
                label="Invert PDF colors"
                description="Light pages on a dark canvas (recommended for dark UI)."
              >
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={pdfPreviewInverted}
                    onChange={(event) => setPdfPreviewInverted(event.target.checked)}
                  />
                  <span className={`${TREE_LABEL_CLASS} text-text-secondary`}>Invert preview</span>
                </label>
              </SettingsRow>
            ) : null}

            {scope === "user" && category === "general" ? (
              <SettingsRow
                label="Recent projects"
                description="Remove all entries from the welcome screen history."
              >
                <button
                  type="button"
                  className={`w-fit rounded-lg border border-border/50 px-3 py-1.5 ${TREE_LABEL_CLASS} text-text-secondary hover:border-danger/30 hover:text-danger cursor-pointer`}
                  onClick={() => {
                    if (!window.confirm("Clear all recently opened workspaces from history?")) {
                      return;
                    }
                    void window.bigTex.recents.clear();
                  }}
                >
                  Clear recent projects
                </button>
              </SettingsRow>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
