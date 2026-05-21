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
  onRun(prompt: string, modelId: string, reasoningLevel: string | null): Promise<void>;
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
  const parts: Array<{ type: "reasoning"; text: string } | { type: "text"; text: string }> = [];

  if (message.role === "assistant") {
    if (message.reasoning.trim()) {
      parts.push({ type: "reasoning", text: message.reasoning });
    }
    if (message.content.trim()) {
      parts.push({ type: "text", text: message.content });
    }
  } else if (message.content.trim()) {
    parts.push({ type: "text", text: message.content });
  }

  return {
    id: message.id,
    role: message.role,
    content: parts.length > 0 ? parts : [{ type: "text", text: "" }],
    createdAt: message.createdAt,
    status: statusForMessage(message),
    metadata: {
      custom: {
        patch: message.patch,
        runId: message.runId,
        activity: message.activity,
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
  const clearAgentHandoffFiles = useAppStore((state) => state.clearAgentHandoffFiles);
  const setAgentComposerDraft = useAppStore((state) => state.setAgentComposerDraft);

  const modelId = useAppStore((state) => state.agentSettings.modelId);
  const reasoningLevel = useAppStore((state) => state.agentSettings.reasoningLevel);

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
      clearAgentHandoffFiles();
      setAgentComposerDraft("");
      await onRun(prompt, modelId, reasoningLevel);
    },
    onCancel: async () => {
      if (runId) await onCancel(runId);
    },
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
