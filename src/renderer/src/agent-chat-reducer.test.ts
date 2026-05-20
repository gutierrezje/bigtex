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
  it("marks the run as started on the active assistant message", () => {
    const next = reduceAgentChat(
      chatWithAssistant(),
      eventAt("started", { runId: RUN_ID, command: "opencode acp" }),
    );

    expect(next.running).toBe(true);
    expect(next.runId).toBe(RUN_ID);
    expect(assistant(next)?.status).toBe("running");
    expect(assistant(next)?.runId).toBe(RUN_ID);
  });

  it("appends thought and message chunks to separate fields", () => {
    let chat = chatWithAssistant();
    chat = reduceAgentChat(chat, eventAt("thought", { runId: RUN_ID, chunk: "think" }));
    chat = reduceAgentChat(chat, eventAt("message", { runId: RUN_ID, chunk: "reply" }));

    expect(assistant(chat)?.reasoning).toBe("think");
    expect(assistant(chat)?.content).toBe("reply");
    expect(chat.running).toBe(true);
  });

  it("records stderr as activity with error status", () => {
    const next = reduceAgentChat(
      chatWithAssistant(),
      eventAt("stderr", { runId: RUN_ID, chunk: "boom\n" }),
    );

    expect(assistant(next)?.activity).toBe("boom\n");
    expect(assistant(next)?.status).toBe("error");
  });

  it("stores patch payloads on the active assistant message", () => {
    const patch = "--- a/main.tex\n+++ b/main.tex\n";
    const next = reduceAgentChat(chatWithAssistant(), eventAt("patch", { runId: RUN_ID, patch }));

    expect(assistant(next)?.patch).toBe(patch);
  });

  it("surfaces agent errors and clears the active assistant", () => {
    const next = reduceAgentChat(
      chatWithAssistant({ running: true }),
      eventAt("error", { runId: RUN_ID, message: "timeout" }),
    );

    expect(next.running).toBe(false);
    expect(next.activeAssistantMessageId).toBeNull();
    expect(assistant(next)?.content).toBe("Agent error: timeout");
    expect(assistant(next)?.status).toBe("error");
  });

  it("appends errors when the assistant already has content", () => {
    const next = reduceAgentChat(
      chatWithAssistant(),
      eventAt("message", { runId: RUN_ID, chunk: "partial" }),
    );
    const errored = reduceAgentChat(next, eventAt("error", { runId: RUN_ID, message: "timeout" }));

    expect(assistant(errored)?.content).toBe("partial\n\nAgent error: timeout");
  });

  it("marks non-zero exit codes as error on finish", () => {
    const next = reduceAgentChat(
      chatWithAssistant({ running: true }),
      eventAt("finished", { runId: RUN_ID, exitCode: 1, durationMs: 10 }),
    );

    expect(next.running).toBe(false);
    expect(next.activeAssistantMessageId).toBeNull();
    expect(assistant(next)?.status).toBe("error");
  });

  it("marks zero exit code as ready on finish", () => {
    const next = reduceAgentChat(
      chatWithAssistant({ running: true }),
      eventAt("finished", { runId: RUN_ID, exitCode: 0, durationMs: 10 }),
    );

    expect(assistant(next)?.status).toBe("ready");
  });

  it("targets the last assistant when activeAssistantMessageId is unset", () => {
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

  it("ignores unknown event types", () => {
    const chat = chatWithAssistant();
    const next = reduceAgentChat(
      chat,
      eventAt("filesChanged", { runId: RUN_ID, paths: ["main.tex"] }),
    );
    expect(next).toBe(chat);
  });
});
