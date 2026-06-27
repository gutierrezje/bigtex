import { create } from "zustand";
import {
  baseModelId,
  normalizeReasoningLevel,
  pickDefaultModel,
  withModelVariants,
} from "../../shared/agent-models";
import {
  activateEditorTab,
  activatePdfTab,
  closeEditorTab,
  closePdfTab,
  type EditorTabsState,
  focusOrOpenEditor,
  focusOrOpenPdf,
  initialEditorTabs,
  initialPdfTabs,
  type PdfTabsState,
  renameEditorPath,
  renamePdfPath,
  replaceEditorFile,
  updateEditorContent,
} from "../../shared/documentTabs";
import type {
  AgentEvent,
  AgentProviderGroup,
  AgentSessionConfig,
  CompileResult,
  OpenFile,
  PdfPayload,
  PerformanceMark,
  ProjectSnapshot,
} from "../../shared/domain";
import type {
  AgentModelPreference,
  AgentPermissionRequestPayload,
  EffectiveSettings,
  UserSettings,
} from "../../shared/settings";
import { DEFAULT_USER_SETTINGS, reconcileAgentModelPreference } from "../../shared/settings";
import {
  type AgentMessagePatch,
  type AgentChatMessage,
  type AgentChatState,
  clearAgentChatPatch,
  reduceAgentChat,
} from "./agent-chat-reducer";
import { readPdfPreviewInvert } from "./lib/pdfPreviewPrefs";
import { schedulePersistWorkspaceAgentModel } from "./lib/persistWorkspaceAgent";

export type SettingsScope = "user" | "workspace";
export type SettingsCategory = "agent" | "pdf" | "general";

export type { AgentChatMessage, AgentChatState, AgentMessagePatch };

export type OutputLevel = "info" | "success" | "warning" | "error";

export interface OutputEntry {
  id: string;
  at: number;
  level: OutputLevel;
  message: string;
}

const MAX_OUTPUT_ENTRIES = 200;

export interface AgentSettingsState {
  config: AgentSessionConfig | null;
  providerGroup: AgentProviderGroup;
  modelId: string;
  reasoningLevel: string | null;
  reasoningProbing: boolean;
  loading: boolean;
  error: string | null;
}

interface AppState {
  project: ProjectSnapshot | null;
  editorTabs: EditorTabsState;
  pdfTabs: PdfTabsState;
  compileResult: CompileResult | null;
  agentChat: AgentChatState;
  agentSettings: AgentSettingsState;
  agentComposerDraft: string;
  pendingHandoffLine: string | null;
  agentHandoffFiles: string[];
  agentComposerFocusToken: number;
  outputLog: OutputEntry[];
  metrics: PerformanceMark[];
  pdfPreviewInverted: boolean;
  effectiveSettings: EffectiveSettings;
  settingsHydrated: boolean;
  settingsOpen: boolean;
  settingsScope: SettingsScope;
  settingsCategory: SettingsCategory;
  permissionQueue: AgentPermissionRequestPayload[];
  setProject(project: ProjectSnapshot | null): void;
  openEditorFile(file: OpenFile): void;
  activateEditorTab(path: string): void;
  closeEditorTabAt(path: string): void;
  updateEditorTabContent(path: string, content: string): void;
  replaceEditorTabFile(file: OpenFile): void;
  clearEditorTabs(): void;
  openPdfTab(pdf: PdfPayload): void;
  activatePdfTab(path: string): void;
  closePdfTabAt(path: string): void;
  clearPdfTabs(): void;
  renameEditorTabPath(oldPath: string, newPath: string, file?: OpenFile): void;
  renamePdfTabPath(oldPath: string, newPath: string): void;
  setCompileResult(result: CompileResult | null): void;
  addAgentUserMessage(content: string): void;
  createPendingAgentMessage(): string;
  appendAgentEvent(event: AgentEvent): void;
  clearAgentMessagePatch(patch: string): void;
  clearAgent(): void;
  loadAgentConfig(rootPath: string): Promise<void>;
  setAgentProviderGroup(group: AgentProviderGroup): void;
  setAgentModelId(modelId: string): void;
  refreshAgentModelVariants(rootPath: string, modelId: string): Promise<void>;
  setAgentReasoningLevel(level: string | null): void;
  setMetrics(metrics: PerformanceMark[]): void;
  refreshMetrics(): Promise<void>;
  appendAgentComposerHandoff(line: string, filePath: string | null): void;
  setAgentComposerDraft(draft: string): void;
  clearPendingHandoffLine(): void;
  clearAgentHandoffFiles(): void;
  appendOutput(message: string, level?: OutputLevel): void;
  clearOutputLog(): void;
  setPdfPreviewInverted(inverted: boolean): void;
  hydrateSettings(): Promise<void>;
  refreshEffectiveSettings(rootPath?: string | null): Promise<void>;
  setSettingsOpen(open: boolean): void;
  setSettingsScope(scope: SettingsScope): void;
  setSettingsCategory(category: SettingsCategory): void;
  updateUserSettingsPatch(patch: Partial<EffectiveSettings>): Promise<void>;
  enqueuePermissionRequest(payload: AgentPermissionRequestPayload): void;
  dequeuePermissionRequest(requestId: string): void;
  applyAgentModelPreference(preference: AgentModelPreference): void;
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAppStore = create<AppState>((set) => ({
  project: null,
  editorTabs: initialEditorTabs(),
  pdfTabs: initialPdfTabs(),
  compileResult: null,
  agentChat: {
    runId: "",
    running: false,
    activeAssistantMessageId: null,
    messages: [],
  },
  agentSettings: {
    config: null,
    providerGroup: "free",
    modelId: "",
    reasoningLevel: null,
    reasoningProbing: false,
    loading: false,
    error: null,
  },
  agentComposerDraft: "",
  pendingHandoffLine: null,
  agentHandoffFiles: [],
  agentComposerFocusToken: 0,
  outputLog: [],
  metrics: [],
  pdfPreviewInverted: DEFAULT_USER_SETTINGS.pdfPreviewInverted,
  effectiveSettings: { ...DEFAULT_USER_SETTINGS },
  settingsHydrated: false,
  settingsOpen: false,
  settingsScope: "user",
  settingsCategory: "agent",
  permissionQueue: [],
  setProject: (project) => set({ project }),
  openEditorFile: (file) =>
    set((state) => ({ editorTabs: focusOrOpenEditor(state.editorTabs, file) })),
  activateEditorTab: (path) =>
    set((state) => ({ editorTabs: activateEditorTab(state.editorTabs, path) })),
  closeEditorTabAt: (path) =>
    set((state) => ({ editorTabs: closeEditorTab(state.editorTabs, path) })),
  updateEditorTabContent: (path, content) =>
    set((state) => ({
      editorTabs: updateEditorContent(state.editorTabs, path, content, true),
    })),
  replaceEditorTabFile: (file) =>
    set((state) => ({ editorTabs: replaceEditorFile(state.editorTabs, file) })),
  clearEditorTabs: () => set({ editorTabs: initialEditorTabs() }),
  openPdfTab: (pdf) => set((state) => ({ pdfTabs: focusOrOpenPdf(state.pdfTabs, pdf) })),
  activatePdfTab: (path) => set((state) => ({ pdfTabs: activatePdfTab(state.pdfTabs, path) })),
  closePdfTabAt: (path) => set((state) => ({ pdfTabs: closePdfTab(state.pdfTabs, path) })),
  clearPdfTabs: () => set({ pdfTabs: initialPdfTabs() }),
  renameEditorTabPath: (oldPath, newPath, file) =>
    set((state) => ({ editorTabs: renameEditorPath(state.editorTabs, oldPath, newPath, file) })),
  renamePdfTabPath: (oldPath, newPath) =>
    set((state) => ({ pdfTabs: renamePdfPath(state.pdfTabs, oldPath, newPath) })),
  setCompileResult: (compileResult) => set({ compileResult }),
  addAgentUserMessage: (content) =>
    set((state) => ({
      agentChat: {
        ...state.agentChat,
        messages: [
          ...state.agentChat.messages,
          {
            id: createMessageId("user"),
            role: "user",
            content,
            reasoning: "",
            activity: "",
            createdAt: new Date(),
            patch: null,
            status: "ready",
          },
        ],
      },
    })),
  createPendingAgentMessage: () => {
    const id = createMessageId("assistant");
    set((state) => ({
      agentChat: {
        ...state.agentChat,
        activeAssistantMessageId: id,
        messages: [
          ...state.agentChat.messages,
          {
            id,
            role: "assistant",
            content: "",
            reasoning: "",
            activity: "",
            createdAt: new Date(),
            patch: null,
            status: "running",
          },
        ],
      },
    }));
    return id;
  },
  appendAgentEvent: (event) =>
    set((state) => ({
      agentChat: reduceAgentChat(state.agentChat, event),
    })),
  clearAgentMessagePatch: (patch) =>
    set((state) => ({
      agentChat: clearAgentChatPatch(state.agentChat, patch),
    })),
  clearAgent: () =>
    set({
      agentChat: {
        runId: "",
        running: false,
        activeAssistantMessageId: null,
        messages: [],
      },
    }),
  loadAgentConfig: async (rootPath) => {
    set((state) => ({
      agentSettings: { ...state.agentSettings, loading: true, error: null },
    }));
    try {
      const [config, effective] = await Promise.all([
        window.bigTex.agent.loadConfig(rootPath),
        window.bigTex.settings.getEffective(rootPath),
      ]);
      const preference = reconcileAgentModelPreference(effective.agentModel, config);
      set({
        effectiveSettings: effective,
        agentSettings: {
          config,
          providerGroup: preference.providerGroup,
          modelId: preference.modelId,
          reasoningLevel: preference.reasoningLevel,
          reasoningProbing: false,
          loading: false,
          error: null,
        },
      });
    } catch (error) {
      set((state) => ({
        agentSettings: {
          ...state.agentSettings,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load OpenCode models",
        },
      }));
    }
  },
  setAgentProviderGroup: (providerGroup) =>
    set((state) => {
      const config = state.agentSettings.config;
      if (!config) return { agentSettings: { ...state.agentSettings, providerGroup } };
      const modelId = pickDefaultModel(config, providerGroup);
      const preference: AgentModelPreference = {
        providerGroup,
        modelId,
        reasoningLevel: null,
      };
      const rootPath = state.project?.rootPath;
      if (rootPath) {
        schedulePersistWorkspaceAgentModel(rootPath, preference);
        void useAppStore.getState().refreshAgentModelVariants(rootPath, modelId);
      }
      return {
        agentSettings: {
          ...state.agentSettings,
          ...preference,
        },
      };
    }),
  setAgentModelId: (modelId) => {
    const base = baseModelId(modelId);
    set((state) => {
      const config = state.agentSettings.config;
      const preference: AgentModelPreference = {
        providerGroup: state.agentSettings.providerGroup,
        modelId: base,
        reasoningLevel: config
          ? normalizeReasoningLevel(config, base, state.agentSettings.reasoningLevel)
          : null,
      };
      const rootPath = state.project?.rootPath;
      if (rootPath) schedulePersistWorkspaceAgentModel(rootPath, preference);
      return {
        agentSettings: {
          ...state.agentSettings,
          ...preference,
        },
      };
    });
    const rootPath = useAppStore.getState().project?.rootPath;
    if (rootPath) {
      void useAppStore.getState().refreshAgentModelVariants(rootPath, base);
    }
  },
  refreshAgentModelVariants: async (rootPath, modelId) => {
    const base = baseModelId(modelId);
    const cached = useAppStore.getState().agentSettings.config?.variantsByModel[base];
    if (cached && cached.length > 0) return;

    set((state) => ({
      agentSettings: { ...state.agentSettings, reasoningProbing: true },
    }));

    try {
      const variants = await window.bigTex.agent.probeModelVariants(rootPath, base);
      set((state) => {
        const config = state.agentSettings.config;
        if (!config) return state;
        const merged = withModelVariants(config, base, variants);
        return {
          agentSettings: {
            ...state.agentSettings,
            config: merged,
            reasoningProbing: false,
            reasoningLevel: normalizeReasoningLevel(
              merged,
              base,
              state.agentSettings.reasoningLevel,
            ),
          },
        };
      });
    } catch {
      set((state) => ({
        agentSettings: { ...state.agentSettings, reasoningProbing: false },
      }));
    }
  },
  setAgentReasoningLevel: (reasoningLevel) =>
    set((state) => {
      const preference: AgentModelPreference = {
        providerGroup: state.agentSettings.providerGroup,
        modelId: state.agentSettings.modelId,
        reasoningLevel,
      };
      const rootPath = state.project?.rootPath;
      if (rootPath) schedulePersistWorkspaceAgentModel(rootPath, preference);
      return {
        agentSettings: { ...state.agentSettings, reasoningLevel },
      };
    }),
  setMetrics: (metrics) => set({ metrics }),
  refreshMetrics: async () => {
    const metrics = await window.bigTex.app.metrics();
    set({ metrics });
  },
  appendAgentComposerHandoff: (line, filePath) =>
    set((state) => ({
      pendingHandoffLine: line,
      agentHandoffFiles: filePath
        ? state.agentHandoffFiles.includes(filePath)
          ? state.agentHandoffFiles
          : [...state.agentHandoffFiles, filePath]
        : state.agentHandoffFiles,
      agentComposerFocusToken: state.agentComposerFocusToken + 1,
    })),
  setAgentComposerDraft: (agentComposerDraft) => set({ agentComposerDraft }),
  clearPendingHandoffLine: () => set({ pendingHandoffLine: null }),
  clearAgentHandoffFiles: () => set({ agentHandoffFiles: [] }),
  appendOutput: (message, level = "info") =>
    set((state) => {
      const entry: OutputEntry = {
        id: createMessageId("output"),
        at: Date.now(),
        level,
        message,
      };
      const next = [...state.outputLog, entry];
      return {
        outputLog: next.length > MAX_OUTPUT_ENTRIES ? next.slice(-MAX_OUTPUT_ENTRIES) : next,
      };
    }),
  clearOutputLog: () => set({ outputLog: [] }),
  setPdfPreviewInverted: (pdfPreviewInverted) => {
    set({ pdfPreviewInverted });
    void window.bigTex.settings.updateUser({ pdfPreviewInverted });
  },
  hydrateSettings: async () => {
    const legacyPdfPreviewInvert = readPdfPreviewInvert();
    const { effective } = await window.bigTex.settings.load({ legacyPdfPreviewInvert });
    set({
      settingsHydrated: true,
      effectiveSettings: effective,
      pdfPreviewInverted: effective.pdfPreviewInverted,
    });
  },
  refreshEffectiveSettings: async (rootPath) => {
    const effective = await window.bigTex.settings.getEffective(rootPath ?? null);
    set({ effectiveSettings: effective, pdfPreviewInverted: effective.pdfPreviewInverted });
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsScope: (settingsScope) => set({ settingsScope }),
  setSettingsCategory: (settingsCategory) => set({ settingsCategory }),
  updateUserSettingsPatch: async (patch) => {
    const userPatch: Partial<UserSettings> = {};
    if (patch.agentPermissionMode != null)
      userPatch.agentPermissionMode = patch.agentPermissionMode;
    if (patch.patchApplyMode != null) userPatch.patchApplyMode = patch.patchApplyMode;
    if (patch.pdfPreviewInverted != null) userPatch.pdfPreviewInverted = patch.pdfPreviewInverted;
    if (patch.agentModel !== undefined) userPatch.agentModel = patch.agentModel;
    await window.bigTex.settings.updateUser(userPatch);
    const rootPath = useAppStore.getState().project?.rootPath ?? null;
    const effective = await window.bigTex.settings.getEffective(rootPath);
    set({
      effectiveSettings: effective,
      pdfPreviewInverted: effective.pdfPreviewInverted,
    });
  },
  enqueuePermissionRequest: (payload) =>
    set((state) => ({
      permissionQueue: [...state.permissionQueue, payload],
      agentComposerFocusToken: state.agentComposerFocusToken + 1,
    })),
  dequeuePermissionRequest: (requestId) =>
    set((state) => ({
      permissionQueue: state.permissionQueue.filter((entry) => entry.requestId !== requestId),
    })),
  applyAgentModelPreference: (preference) =>
    set((state) => ({
      agentSettings: {
        ...state.agentSettings,
        providerGroup: preference.providerGroup,
        modelId: preference.modelId,
        reasoningLevel: preference.reasoningLevel,
      },
    })),
}));
