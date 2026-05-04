import { create } from "zustand";
import type {
  AgentEvent,
  CompileResult,
  CompilerKind,
  OpenFile,
  PdfPayload,
  PerformanceMark,
  ProjectSnapshot,
} from "../../shared/domain";

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
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

      if (event.type === "stdout" || event.type === "stderr") {
        return {
          agentChat: {
            ...chat,
            running: true,
            activeAssistantMessageId,
            messages: updateActiveAssistantMessage((message) => ({
              ...message,
              runId: event.runId,
              content: `${message.content}${event.chunk}`,
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
  setMetrics: (metrics) => set({ metrics }),
}));
