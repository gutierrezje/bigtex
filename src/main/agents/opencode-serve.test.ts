import { describe, expect, it } from "vitest";
import type { AgentEvent } from "../../shared/domain";
import {
  handleServeEvent,
  parseServeProvidersConfig,
  type ServeService,
  splitServeModelId,
} from "./opencode-serve";

describe("opencode serve config", () => {
  it("parses supported providers into AgentSessionConfig", () => {
    const config = parseServeProvidersConfig({
      providers: [
        {
          id: "opencode",
          models: {
            "deepseek-v4-flash-free": {
              name: "DeepSeek V4 Flash",
              variants: { default: {}, high: {}, low: {} },
            },
          },
        },
        {
          id: "opencode-go",
          models: {
            "glm-5": {
              name: "GLM 5",
              variants: { xhigh: {}, medium: {} },
            },
          },
        },
        {
          id: "anthropic",
          models: {
            "claude-sonnet": { name: "Claude Sonnet" },
          },
        },
      ],
      default: { opencode: "deepseek-v4-flash-free" },
    });

    expect(config.currentModelId).toBe("opencode/deepseek-v4-flash-free");
    expect(config.models.map((model) => model.id).sort()).toEqual([
      "opencode-go/glm-5",
      "opencode/deepseek-v4-flash-free",
    ]);
    expect(config.models.find((model) => model.id === "opencode-go/glm-5")?.providerGroup).toBe(
      "go",
    );
    expect(config.variantsByModel["opencode/deepseek-v4-flash-free"]).toEqual(["high", "low"]);
    expect(config.variantsByModel["opencode-go/glm-5"]).toEqual(["xhigh", "medium"]);
  });

  it("falls back to the first supported model when defaults are unsupported", () => {
    const config = parseServeProvidersConfig({
      providers: [
        {
          id: "opencode-go",
          models: {
            "glm-5": { name: "GLM 5" },
          },
        },
      ],
      default: { anthropic: "claude-sonnet" },
    });

    expect(config.currentModelId).toBe("opencode-go/glm-5");
  });
});

describe("opencode serve run events", () => {
  function serviceWithRun(events: AgentEvent[] = []): ServeService {
    return {
      baseUrl: "http://127.0.0.1:1234",
      child: {} as ServeService["child"],
      sessionId: "session-1",
      eventAbort: null,
      activeRun: {
        runId: "run-1",
        sessionId: "session-1",
        startedAt: performance.now(),
        emit: (event) => events.push(event),
        textParts: new Map(),
      },
    };
  }

  it("splits BigTeX model ids into serve provider and model ids", () => {
    expect(splitServeModelId("opencode/deepseek-v4-flash-free/high")).toEqual({
      providerID: "opencode",
      modelID: "deepseek-v4-flash-free/high",
    });
  });

  it("emits only new text for repeated message part snapshots", () => {
    const events: AgentEvent[] = [];
    const service = serviceWithRun(events);

    handleServeEvent(service, {
      type: "message.part.updated",
      properties: {
        sessionID: "session-1",
        messageID: "message-1",
        part: { id: "part-1", type: "text", text: "Hel" },
      },
    });
    handleServeEvent(service, {
      type: "message.part.updated",
      properties: {
        sessionID: "session-1",
        messageID: "message-1",
        part: { id: "part-1", type: "text", text: "Hello" },
      },
    });

    expect(events).toMatchObject([
      { type: "message", runId: "run-1", chunk: "Hel" },
      { type: "message", runId: "run-1", chunk: "lo" },
    ]);
  });

  it("ignores events for other sessions and finishes on idle", () => {
    const events: AgentEvent[] = [];
    const service = serviceWithRun(events);

    handleServeEvent(service, {
      type: "message.part.updated",
      properties: {
        sessionID: "session-2",
        part: { id: "part-1", type: "text", text: "wrong" },
      },
    });
    handleServeEvent(service, {
      type: "session.idle",
      properties: { sessionID: "session-1" },
    });

    expect(events).toMatchObject([{ type: "finished", runId: "run-1", exitCode: 0 }]);
    expect(service.activeRun).toBeNull();
  });

  it("maps reasoning and tool parts to existing agent events", () => {
    const events: AgentEvent[] = [];
    const service = serviceWithRun(events);

    handleServeEvent(service, {
      type: "message.part.updated",
      properties: {
        sessionID: "session-1",
        part: { id: "reason-1", type: "reasoning", text: "thinking" },
      },
    });
    handleServeEvent(service, {
      type: "message.part.updated",
      properties: {
        sessionID: "session-1",
        part: { id: "tool-1", type: "tool", title: "Read file", state: "running" },
      },
    });

    expect(events).toMatchObject([
      { type: "thought", runId: "run-1", chunk: "thinking" },
      { type: "activity", runId: "run-1", chunk: "\n[tool:running] Read file\n" },
    ]);
  });

  it("turns serve errors into terminal agent events", () => {
    const events: AgentEvent[] = [];
    const service = serviceWithRun(events);

    handleServeEvent(service, {
      type: "session.error",
      properties: {
        sessionID: "session-1",
        error: { message: "provider failed" },
      },
    });

    expect(events).toMatchObject([
      { type: "error", runId: "run-1", message: "provider failed" },
      { type: "finished", runId: "run-1", exitCode: null },
    ]);
    expect(service.activeRun).toBeNull();
  });
});
