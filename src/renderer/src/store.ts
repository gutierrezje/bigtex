import { create } from "zustand";
import {
  baseModelId,
  normalizeReasoningLevel,
  pickDefaultModel,
  providerGroupFromModelId,
  withModelVariants,
} from "../../shared/agent-models";
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
import { appendAgentHandoffToComposer } from "../../shared/problems";
import { type AgentChatMessage, type AgentChatState, reduceAgentChat } from "./agent-chat-reducer";

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
  openFile: OpenFile | null;
  compileResult: CompileResult | null;
  pdf: PdfPayload | null;
  agentChat: AgentChatState;
  agentSettings: AgentSettingsState;
  agentComposerDraft: string;
  agentHandoffFiles: string[];
  agentComposerFocusToken: number;
  outputLog: OutputEntry[];
  metrics: PerformanceMark[];
  setProject(project: ProjectSnapshot | null): void;
  setOpenFile(file: OpenFile | null): void;
  updateOpenFileContent(content: string): void;
  setCompileResult(result: CompileResult | null): void;
  setPdf(pdf: PdfPayload | null): void;
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
  clearAgentHandoffFiles(): void;
  appendOutput(message: string, level?: OutputLevel): void;
  clearOutputLog(): void;
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAppStore = create<AppState>((set) => ({
  project: null,
  openFile: null,
  compileResult: null,
  pdf: null,
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
  agentHandoffFiles: [],
  agentComposerFocusToken: 0,
  outputLog: [],
  metrics: [],
  setProject: (project) => set({ project }),
  setOpenFile: (openFile) => set({ openFile }),
  updateOpenFileContent: (content) =>
    set((state) => ({
      openFile: state.openFile ? { ...state.openFile, content, dirty: true } : null,
    })),
  setCompileResult: (compileResult) => set({ compileResult }),
  setPdf: (pdf) => set({ pdf }),
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
      const currentGroup = providerGroupFromModelId(config.currentModelId);
      const providerGroup: AgentProviderGroup = currentGroup === "go" ? "go" : "free";
      const modelId = baseModelId(config.currentModelId) || pickDefaultModel(config, providerGroup);
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
      agentComposerDraft: appendAgentHandoffToComposer(state.agentComposerDraft, line),
      agentHandoffFiles: filePath
        ? state.agentHandoffFiles.includes(filePath)
          ? state.agentHandoffFiles
          : [...state.agentHandoffFiles, filePath]
        : state.agentHandoffFiles,
      agentComposerFocusToken: state.agentComposerFocusToken + 1,
    })),
  setAgentComposerDraft: (agentComposerDraft) => set({ agentComposerDraft }),
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
}));
