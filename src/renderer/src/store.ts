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
  CompilerKind,
  OpenFile,
  PdfPayload,
  PerformanceMark,
  ProjectSnapshot,
} from "../../shared/domain";

export interface AgentSettingsState {
  config: AgentSessionConfig | null;
  providerGroup: AgentProviderGroup;
  modelId: string;
  reasoningLevel: string | null;
  reasoningProbing: boolean;
  loading: boolean;
  error: string | null;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  /** User-visible assistant reply (ACP agent_message_chunk). */
  content: string;
  /** Model reasoning stream (ACP agent_thought_chunk). */
  reasoning: string;
  /** Tool calls, plans, and other operational log lines. */
  activity: string;
  createdAt: Date;
  runId?: string;
  patch: string | null;
  status: "ready" | "running" | "error";
}

export interface AgentChatState {
  runId: string;
  running: boolean;
  activeAssistantMessageId: string | null;
  messages: AgentChatMessage[];
}

interface AppState {
  project: ProjectSnapshot | null;
  openFile: OpenFile | null;
  compiler: CompilerKind;
  compileResult: CompileResult | null;
  pdf: PdfPayload | null;
  agentChat: AgentChatState;
  agentSettings: AgentSettingsState;
  metrics: PerformanceMark[];
  setProject(project: ProjectSnapshot | null): void;
  setOpenFile(file: OpenFile | null): void;
  updateOpenFileContent(content: string): void;
  setCompileResult(result: CompileResult | null): void;
  setPdf(pdf: PdfPayload | null): void;
  setCompiler(compiler: CompilerKind): void;
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
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAppStore = create<AppState>((set) => ({
  project: null,
  openFile: null,
  compiler: "latexmk",
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
  metrics: [],
  setProject: (project) => set({ project }),
  setOpenFile: (openFile) => set({ openFile }),
  updateOpenFileContent: (content) =>
    set((state) => ({
      openFile: state.openFile ? { ...state.openFile, content, dirty: true } : null,
    })),
  setCompileResult: (compileResult) => set({ compileResult }),
  setPdf: (pdf) => set({ pdf }),
  setCompiler: (compiler) => set({ compiler }),
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
    set((state) => {
      const chat = state.agentChat;
      const lastAssistantMessage = [...chat.messages]
        .reverse()
        .find((message) => message.role === "assistant");
      const activeAssistantMessageId =
        chat.activeAssistantMessageId ?? lastAssistantMessage?.id ?? null;

      function updateActiveAssistantMessage(
        updater: (message: AgentChatMessage) => AgentChatMessage,
      ): AgentChatMessage[] {
        if (!activeAssistantMessageId) return chat.messages;
        return chat.messages.map((message) =>
          message.id === activeAssistantMessageId ? updater(message) : message,
        );
      }

      if (event.type === "started") {
        return {
          agentChat: {
            ...chat,
            runId: event.runId,
            running: true,
            activeAssistantMessageId,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              status: "running",
            })),
          },
        };
      }

      if (event.type === "thought") {
        return {
          agentChat: {
            ...chat,
            running: true,
            activeAssistantMessageId,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              reasoning: `${message.reasoning}${event.chunk}`,
              status: "running",
            })),
          },
        };
      }

      if (event.type === "message") {
        return {
          agentChat: {
            ...chat,
            running: true,
            activeAssistantMessageId,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              content: `${message.content}${event.chunk}`,
              status: "running",
            })),
          },
        };
      }

      if (event.type === "activity" || event.type === "stderr") {
        return {
          agentChat: {
            ...chat,
            running: true,
            activeAssistantMessageId,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              activity: `${message.activity}${event.chunk}`,
              status: event.type === "stderr" ? "error" : "running",
            })),
          },
        };
      }

      if (event.type === "patch") {
        return {
          agentChat: {
            ...chat,
            activeAssistantMessageId,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              patch: event.patch,
            })),
          },
        };
      }

      if (event.type === "error") {
        return {
          agentChat: {
            ...chat,
            running: false,
            activeAssistantMessageId: null,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              content: message.content
                ? `${message.content}\n\nAgent error: ${event.message}`
                : `Agent error: ${event.message}`,
              status: "error",
            })),
          },
        };
      }

      if (event.type === "finished") {
        return {
          agentChat: {
            ...chat,
            running: false,
            activeAssistantMessageId: null,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              status: event.exitCode && event.exitCode !== 0 ? "error" : "ready",
            })),
          },
        };
      }

      return { agentChat: chat };
    }),
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
}));
