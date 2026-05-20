import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentEvent } from "../../shared/domain";
import {
  handleAcpNotification,
  patchFromToolCallUpdate,
  textFromAcpContent,
  toProjectRelative,
} from "./acp-notifications";

function collectEvents(
  notification: Parameters<typeof handleAcpNotification>[0],
  rootPath: string,
): { events: AgentEvent[]; transcript: string } {
  const events: AgentEvent[] = [];
  let transcript = "";
  handleAcpNotification(
    notification,
    "run-1",
    rootPath,
    (text) => {
      transcript += text;
    },
    (event) => events.push(event),
  );
  return { events, transcript };
}

describe("textFromAcpContent", () => {
  it("reads nested text blocks", () => {
    expect(
      textFromAcpContent({
        type: "content",
        content: { type: "text", text: "hello" },
      }),
    ).toBe("hello");
  });
});

describe("toProjectRelative", () => {
  it("normalizes absolute paths under the project root", () => {
    const root = resolve("/tmp/proj");
    expect(toProjectRelative(root, join(root, "main.tex"))).toBe("main.tex");
  });
});

describe("patchFromToolCallUpdate", () => {
  it("builds a unified diff from tool diff blocks", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-acp-"));
    try {
      const patch = patchFromToolCallUpdate(
        {
          content: [
            {
              type: "diff",
              path: "main.tex",
              oldText: "old\n",
              newText: "new\n",
            },
          ],
        },
        root,
      );

      expect(patch).toContain("--- a/main.tex");
      expect(patch).toContain("+new");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("handleAcpNotification", () => {
  it("ignores non-session notifications", () => {
    const { events } = collectEvents({ jsonrpc: "2.0", method: "other" }, "/tmp/proj");
    expect(events).toHaveLength(0);
  });

  it("emits message chunks for agent_message_chunk updates", () => {
    const { events, transcript } = collectEvents(
      {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "Hello" },
          },
        },
      },
      "/tmp/proj",
    );

    expect(events).toMatchObject([{ type: "message", chunk: "Hello", runId: "run-1" }]);
    expect(transcript).toBe("Hello");
  });

  it("emits patch events when a tool call completes with diff content", async () => {
    const root = await mkdtemp(join(tmpdir(), "bigtex-acp-patch-"));
    try {
      await writeFile(join(root, "main.tex"), "old\n", "utf8");

      const { events } = collectEvents(
        {
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            update: {
              sessionUpdate: "tool_call_update",
              title: "Write file",
              status: "completed",
              content: [
                {
                  type: "diff",
                  path: "main.tex",
                  oldText: "old\n",
                  newText: "new\n",
                },
              ],
            },
          },
        },
        root,
      );

      expect(events.some((event) => event.type === "activity")).toBe(true);
      const patchEvent = events.find((event) => event.type === "patch");
      expect(patchEvent).toMatchObject({ type: "patch", runId: "run-1" });
      if (patchEvent?.type === "patch") {
        expect(patchEvent.patch).toContain("main.tex");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("emits plan activity for plan updates", () => {
    const { events } = collectEvents(
      {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          update: {
            sessionUpdate: "plan",
            entries: [{ status: "pending", content: "Fix abstract" }],
          },
        },
      },
      "/tmp/proj",
    );

    expect(events).toMatchObject([
      { type: "activity", chunk: expect.stringContaining("Fix abstract") },
    ]);
  });
});
