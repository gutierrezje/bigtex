import { relative, resolve, sep } from "node:path";
import type { AgentEvent } from "../../shared/domain";
import { resolvePatchPath, unifiedDiffFromTexts } from "./patch";

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export function toProjectRelative(rootPath: string, filePath: string): string {
  const root = resolve(rootPath);
  const absolute = filePath.startsWith("/") ? resolve(filePath) : resolve(root, filePath);
  return relative(root, absolute).split(sep).join("/");
}

export function textFromAcpContent(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const block = content as { type?: unknown; text?: unknown; content?: unknown };

  if (block.type === "text" && typeof block.text === "string") {
    return block.text;
  }

  if (block.type === "content") {
    return textFromAcpContent(block.content);
  }

  return null;
}

export function patchFromToolCallUpdate(
  update: Record<string, unknown>,
  rootPath: string,
): string | null {
  const content = update.content;
  if (!Array.isArray(content)) return null;

  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const block = item as { type?: unknown; path?: unknown; oldText?: unknown; newText?: unknown };
    if (block.type !== "diff" || typeof block.path !== "string") continue;

    const oldText = typeof block.oldText === "string" ? block.oldText : "";
    const newText = typeof block.newText === "string" ? block.newText : "";
    const relativePath = resolvePatchPath(toProjectRelative(rootPath, block.path), rootPath);
    const patch = unifiedDiffFromTexts(relativePath, oldText, newText);
    if (patch) return patch;
  }

  return null;
}

export function handleAcpNotification(
  message: JsonRpcNotification,
  runId: string,
  rootPath: string,
  appendTranscript: (text: string) => void,
  emit: (event: AgentEvent) => void,
): void {
  if (message.method !== "session/update") return;

  const params = message.params as { update?: Record<string, unknown> } | undefined;
  const update = params?.update;
  if (!update) return;

  const updateKind = update.sessionUpdate;

  if (updateKind === "agent_thought_chunk") {
    const text = textFromAcpContent(update.content);
    if (!text) return;

    appendTranscript(text);
    emit({ type: "thought", runId, chunk: text, at: Date.now() });
    return;
  }

  if (updateKind === "agent_message_chunk") {
    const text = textFromAcpContent(update.content);
    if (!text) return;

    appendTranscript(text);
    emit({ type: "message", runId, chunk: text, at: Date.now() });
    return;
  }

  if (updateKind === "tool_call") {
    const title = typeof update.title === "string" ? update.title : "Tool call";
    const chunk = `\n\n[tool] ${title}\n`;
    appendTranscript(chunk);
    emit({ type: "activity", runId, chunk, at: Date.now() });
    return;
  }

  if (updateKind === "tool_call_update") {
    const title = typeof update.title === "string" ? update.title : "Tool update";
    const status = typeof update.status === "string" ? update.status : "updated";
    const chunk = `\n[tool:${status}] ${title}\n`;
    appendTranscript(chunk);
    emit({ type: "activity", runId, chunk, at: Date.now() });

    if (status === "completed") {
      const patch = patchFromToolCallUpdate(update, rootPath);
      if (patch) {
        emit({
          type: "patch",
          runId,
          patch,
          status: "applied",
          source: "opencode-session",
          at: Date.now(),
        });
      }
    }
    return;
  }

  if (updateKind === "plan") {
    const entries = Array.isArray(update.entries) ? update.entries : [];
    const chunk = entries
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const item = entry as { status?: unknown; content?: unknown };
        return `- ${String(item.status ?? "pending")}: ${String(item.content ?? "")}`;
      })
      .filter(Boolean)
      .join("\n");
    if (chunk) {
      const planText = `\n\nPlan:\n${chunk}\n`;
      appendTranscript(planText);
      emit({ type: "activity", runId, chunk: planText, at: Date.now() });
    }
  }
}
