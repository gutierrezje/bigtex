import { describe, expect, it } from "vitest";
import type { AgentEvent } from "../../shared/domain";
import { type AgentChatState, reduceAgentChat } from "./agent-chat-reducer";

const RUN_ID = "run-1";
const ASSISTANT_ID = "assistant-1";

function eventAt<T extends AgentEvent["type"]>(
  type: T,
  payload: Omit<Extract<AgentEvent, { type: T }>, "type" | "at">,
): Extract<AgentEvent, { type: T }> {
  return { type, at: 1, ...payload } as Extract<AgentEvent, { type: T }>;
}

function chatWithAssistant(overrides: Partial<AgentChatState> = {}): AgentChatState {
  return {
    runId: "",
    running: false,
    activeAssistantMessageId: ASSISTANT_ID,
    messages: [
      {
        id: ASSISTANT_ID,
        role: "assistant",
        content: "",
        reasoning: "",
        activity: "",
        createdAt: new Date(),
        patch: null,
        status: "running",
      },
    ],
    ...overrides,
  };
}

function assistant(chat: AgentChatState) {
  return chat.messages.find((message) => message.id === ASSISTANT_ID);
}

describe("reduceAgentChat", () => {
  it("streams chunks onto the active assistant and marks the run started", () => {
    let chat = reduceAgentChat(
      chatWithAssistant(),
      eventAt("started", { runId: RUN_ID, command: "opencode acp" }),
    );
    expect(chat.running).toBe(true);
    expect(chat.runId).toBe(RUN_ID);

    chat = reduceAgentChat(chat, eventAt("thought", { runId: RUN_ID, chunk: "think" }));
    chat = reduceAgentChat(chat, eventAt("message", { runId: RUN_ID, chunk: "reply" }));
    expect(assistant(chat)?.reasoning).toBe("think");
    expect(assistant(chat)?.content).toBe("reply");
  });

  it("records stderr, tool patches, and keeps streaming state", () => {
    const stderr = reduceAgentChat(
      chatWithAssistant(),
      eventAt("stderr", { runId: RUN_ID, chunk: "boom\n" }),
    );
    expect(assistant(stderr)?.activity).toBe("boom\n");
    expect(assistant(stderr)?.status).toBe("error");

    const patchText = "--- a/main.tex\n+++ b/main.tex\n";
    const patched = reduceAgentChat(
      chatWithAssistant(),
      eventAt("patch", { runId: RUN_ID, patch: patchText }),
    );
    expect(assistant(patched)?.patch).toBe(patchText);
  });

  it("surfaces fatal errors and maps finish exit codes", () => {
    const errored = reduceAgentChat(
      chatWithAssistant(),
      eventAt("error", { runId: RUN_ID, message: "timeout" }),
    );
    expect(errored.running).toBe(false);
    expect(errored.activeAssistantMessageId).toBeNull();
    expect(assistant(errored)?.content).toBe("Agent error: timeout");

    let chat = reduceAgentChat(
      chatWithAssistant(),
      eventAt("message", { runId: RUN_ID, chunk: "partial" }),
    );
    chat = reduceAgentChat(chat, eventAt("error", { runId: RUN_ID, message: "timeout" }));
    expect(assistant(chat)?.content).toBe("partial\n\nAgent error: timeout");

    const failed = reduceAgentChat(
      chatWithAssistant({ running: true }),
      eventAt("finished", { runId: RUN_ID, exitCode: 1, durationMs: 1 }),
    );
    expect(assistant(failed)?.status).toBe("error");

    const ok = reduceAgentChat(
      chatWithAssistant({ running: true }),
      eventAt("finished", { runId: RUN_ID, exitCode: 0, durationMs: 1 }),
    );
    expect(assistant(ok)?.status).toBe("ready");
  });

  it("falls back to the last assistant when none is active", () => {
    const chat: AgentChatState = {
      runId: "",
      running: false,
      activeAssistantMessageId: null,
      messages: [
        {
          id: "user-1",
          role: "user",
          content: "hi",
          reasoning: "",
          activity: "",
          createdAt: new Date(),
          patch: null,
          status: "ready",
        },
        {
          id: ASSISTANT_ID,
          role: "assistant",
          content: "",
          reasoning: "",
          activity: "",
          createdAt: new Date(),
          patch: null,
          status: "running",
        },
      ],
    };

    const next = reduceAgentChat(chat, eventAt("message", { runId: RUN_ID, chunk: "ok" }));
    expect(assistant(next)?.content).toBe("ok");
  });
});
