import { create } from "zustand";
import {
  baseModelId,
  normalizeReasoningLevel,
  pickDefaultModel,
  resolveAgentUiSelection,
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
import { type AgentChatMessage, type AgentChatState, reduceAgentChat } from "./agent-chat-reducer";
import { readPdfPreviewInvert, writePdfPreviewInvert } from "./lib/pdfPreviewPrefs";

export type { AgentChatMessage, AgentChatState };

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
  pdfPreviewInverted: readPdfPreviewInvert(),
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
      const config = await window.bigTex.agent.loadConfig(rootPath);
      const { providerGroup, modelId } = resolveAgentUiSelection(config);
      set({
        agentSettings: {
          config,
          providerGroup,
          modelId,
          reasoningLevel: normalizeReasoningLevel(config, modelId, config.currentVariant),
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
      const next = {
        agentSettings: {
          ...state.agentSettings,
          providerGroup,
          modelId,
          reasoningLevel: null,
        },
      };
      const rootPath = state.project?.rootPath;
      if (rootPath) {
        void useAppStore.getState().refreshAgentModelVariants(rootPath, modelId);
      }
      return next;
    }),
  setAgentModelId: (modelId) => {
    const base = baseModelId(modelId);
    set((state) => {
      const config = state.agentSettings.config;
      return {
        agentSettings: {
          ...state.agentSettings,
          modelId: base,
          reasoningLevel: config
            ? normalizeReasoningLevel(config, base, state.agentSettings.reasoningLevel)
            : null,
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
    set((state) => ({
      agentSettings: { ...state.agentSettings, reasoningLevel },
    })),
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
    writePdfPreviewInvert(pdfPreviewInverted);
    set({ pdfPreviewInverted });
  },
}));
