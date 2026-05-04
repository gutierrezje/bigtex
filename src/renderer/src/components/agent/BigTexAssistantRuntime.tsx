import {
  type AppendMessage,
  AssistantRuntimeProvider,
  type ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import type { ReactNode } from "react";
import type { AgentChatMessage } from "../../store";
import { useAppStore } from "../../store";

interface BigTexAssistantRuntimeProps {
  children: ReactNode;
  disabled: boolean;
  onRun(prompt: string): Promise<void>;
  onCancel(runId: string): Promise<void>;
}

function textFromAppendMessage(message: AppendMessage): string {
  return message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function statusForMessage(message: AgentChatMessage): ThreadMessageLike["status"] {
  if (message.role !== "assistant") return undefined;
  if (message.status === "running") return { type: "running" };
  if (message.status === "error") {
    return { type: "incomplete", reason: "error" };
  }
  return { type: "complete", reason: "stop" };
}

function convertMessage(message: AgentChatMessage): ThreadMessageLike {
  return {
    id: message.id,
    role: message.role,
    content: [{ type: "text", text: message.content }],
    createdAt: message.createdAt,
    status: statusForMessage(message),
    metadata: {
      custom: {
        patch: message.patch,
        runId: message.runId,
      },
    },
  };
}

export function BigTexAssistantRuntime({
  children,
  disabled,
  onRun,
  onCancel,
}: BigTexAssistantRuntimeProps) {
  const messages = useAppStore((state) => state.agentChat.messages);
  const isRunning = useAppStore((state) => state.agentChat.running);
  const runId = useAppStore((state) => state.agentChat.runId);
  const addAgentUserMessage = useAppStore((state) => state.addAgentUserMessage);
  const createPendingAgentMessage = useAppStore((state) => state.createPendingAgentMessage);

  const runtime = useExternalStoreRuntime<AgentChatMessage>({
    messages,
    isRunning,
    isDisabled: disabled,
    convertMessage,
    onNew: async (message) => {
      const prompt = textFromAppendMessage(message);
      if (!prompt) return;

      addAgentUserMessage(prompt);
      createPendingAgentMessage();
      await onRun(prompt);
    },
    onCancel: async () => {
      if (runId) await onCancel(runId);
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
