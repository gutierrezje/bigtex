import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentEvent } from "../../shared/domain";
import { handleAcpNotification } from "./acp-notifications";

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

describe("handleAcpNotification", () => {
  it("turns agent_message_chunk into message events and transcript", () => {
    const { events, transcript } = collectEvents(
      {
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "content",
              content: { type: "text", text: "Hello" },
            },
          },
        },
      },
      "/tmp/proj",
    );

    expect(events).toMatchObject([{ type: "message", chunk: "Hello", runId: "run-1" }]);
    expect(transcript).toBe("Hello");
  });

  it("emits a patch when a completed tool update includes diff blocks", async () => {
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
});
