import type { AgentEvent } from "../../shared/domain";

export type AgentMessagePatch = Pick<
  Extract<AgentEvent, { type: "patch" }>,
  "patch" | "status" | "source"
>;

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning: string;
  activity: string;
  createdAt: Date;
  runId?: string;
  patch: AgentMessagePatch | null;
  status: "ready" | "running" | "error";
}

export interface AgentChatState {
  runId: string;
  running: boolean;
  activeAssistantMessageId: string | null;
  messages: AgentChatMessage[];
}

export function reduceAgentChat(chat: AgentChatState, event: AgentEvent): AgentChatState {
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
      ...chat,
      runId: event.runId,
      running: true,
      activeAssistantMessageId,
      messages: updateActiveAssistantMessage((message) => ({
        ...message,
        runId: event.runId,
        status: "running",
      })),
    };
  }

  if (event.type === "thought") {
    return {
      ...chat,
      running: true,
      activeAssistantMessageId,
      messages: updateActiveAssistantMessage((message) => ({
        ...message,
        runId: event.runId,
        reasoning: `${message.reasoning}${event.chunk}`,
        status: "running",
      })),
    };
  }

  if (event.type === "message") {
    return {
      ...chat,
      running: true,
      activeAssistantMessageId,
      messages: updateActiveAssistantMessage((message) => ({
        ...message,
        runId: event.runId,
        content: `${message.content}${event.chunk}`,
        status: "running",
      })),
    };
  }

  if (event.type === "activity" || event.type === "stderr") {
    return {
      ...chat,
      running: true,
      activeAssistantMessageId,
      messages: updateActiveAssistantMessage((message) => ({
        ...message,
        runId: event.runId,
        activity: `${message.activity}${event.chunk}`,
        status: event.type === "stderr" ? "error" : "running",
      })),
    };
  }

  if (event.type === "patch") {
    return {
      ...chat,
      activeAssistantMessageId,
      messages: updateActiveAssistantMessage((message) => ({
        ...message,
        runId: event.runId,
        patch: {
          patch: event.patch,
          status: event.status,
          source: event.source,
        },
      })),
    };
  }

  if (event.type === "error") {
    return {
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
    };
  }

  if (event.type === "finished") {
    return {
      ...chat,
      running: false,
      activeAssistantMessageId: null,
      messages: updateActiveAssistantMessage((message) => ({
        ...message,
        runId: event.runId,
        status: event.exitCode && event.exitCode !== 0 ? "error" : "ready",
      })),
    };
  }

  return chat;
}

/** Clear a detected patch from chat after the user applies it (or auto-apply succeeds). */
export function clearAgentChatPatch(chat: AgentChatState, patch: string): AgentChatState {
  return {
    ...chat,
    messages: chat.messages.map((message) =>
      message.patch?.patch === patch ? { ...message, patch: null } : message,
    ),
  };
}
