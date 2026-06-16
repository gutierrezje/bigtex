import { describe, expect, it } from "vitest";
import type { AgentEvent } from "../../shared/domain";
import {
  handleServeEvent,
  parseServeProvidersConfig,
  type ServeService,
  servePermissionResponseForChoice,
  splitServeModelId,
  unifiedPatchFromServeDiffs,
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
      rootPath: "/tmp/project",
      baseUrl: "http://127.0.0.1:1234",
      child: {} as ServeService["child"],
      sessionId: "session-1",
      eventAbort: null,
      permissionSessionAllowed: false,
      resolvePermission: async () => "once",
      postPermissionResponse: async () => {},
      fetchSessionDiff: async () => [],
      activeRun: {
        runId: "run-1",
        sessionId: "session-1",
        startedAt: performance.now(),
        emit: (event) => events.push(event),
        textParts: new Map(),
        emittedPatches: new Set(),
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

  it("maps permission choices to serve responses", () => {
    expect(servePermissionResponseForChoice("once")).toBe("once");
    expect(servePermissionResponseForChoice("always")).toBe("always");
    expect(servePermissionResponseForChoice("allow-session")).toBe("always");
    expect(servePermissionResponseForChoice("reject")).toBe("reject");
    expect(servePermissionResponseForChoice(null)).toBe("reject");
  });

  it("responds to serve permission events through the existing permission bridge choice", async () => {
    const posted: Array<{ sessionId: string; permissionId: string; response: string }> = [];
    const service = serviceWithRun();
    service.resolvePermission = async (_runId, params) => {
      expect(params.path).toBe("main.tex");
      expect(params.options?.map((option) => option.optionId)).toEqual([
        "once",
        "always",
        "reject",
      ]);
      return "always";
    };
    service.postPermissionResponse = async (sessionId, permissionId, response) => {
      posted.push({ sessionId, permissionId, response });
    };

    handleServeEvent(service, {
      type: "permission.updated",
      properties: {
        sessionID: "session-1",
        permissionID: "perm-1",
        permission: { path: "main.tex" },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(posted).toEqual([
      { sessionId: "session-1", permissionId: "perm-1", response: "always" },
    ]);
    expect(service.permissionSessionAllowed).toBe(true);
  });

  it("converts serve diffs into unified patches", () => {
    const patch = unifiedPatchFromServeDiffs([
      {
        file: "main.tex",
        before: "old\n",
        after: "new\n",
      },
    ]);

    expect(patch).toContain("--- a/main.tex");
    expect(patch).toContain("+++ b/main.tex");
    expect(patch).toContain("-old");
    expect(patch).toContain("+new");
  });

  it("emits changed files and a deduped patch for edited files", async () => {
    const events: AgentEvent[] = [];
    const service = serviceWithRun(events);
    service.fetchSessionDiff = async () => [{ file: "main.tex", before: "old\n", after: "new\n" }];

    handleServeEvent(service, {
      type: "file.edited",
      properties: {
        sessionID: "session-1",
        file: { path: "main.tex" },
      },
    });
    handleServeEvent(service, {
      type: "session.diff",
      properties: {
        sessionID: "session-1",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events.find((event) => event.type === "filesChanged")).toMatchObject({
      type: "filesChanged",
      paths: ["main.tex"],
    });
    expect(events.filter((event) => event.type === "patch")).toHaveLength(1);
  });

  it("rejects edited file paths outside the project root", () => {
    const events: AgentEvent[] = [];
    const service = serviceWithRun(events);

    handleServeEvent(service, {
      type: "file.edited",
      properties: {
        sessionID: "session-1",
        file: { path: "../outside.tex" },
      },
    });

    expect(events).toMatchObject([{ type: "stderr", runId: "run-1" }]);
    if (events[0]?.type === "stderr") {
      expect(events[0].chunk).toContain("outside the project");
    }
  });
});
