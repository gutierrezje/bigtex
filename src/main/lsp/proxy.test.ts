import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkTexlab,
  sendLspMessage,
  setLspServerMessageHandler,
  startTexlabSession,
  stopAllTexlabSessions,
} from "./texlab";

const HAS_TEXLAB = process.platform !== "win32";

describe.skipIf(!HAS_TEXLAB)("LSP IPC proxy", () => {
  it("forwards initialize and returns capabilities", { timeout: 20_000 }, async () => {
    const available = await checkTexlab();
    if (!available.available) return;

    const root = await mkdtemp(join(tmpdir(), "bigtex-lsp-proxy-"));
    try {
      await writeFile(
        join(root, "main.tex"),
        "\\documentclass{article}\\begin{document}Hi\\end{document}\n",
        "utf8",
      );

      const status = await startTexlabSession(root, "main.tex");
      expect(status.active).toBe(true);

      const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Timed out waiting for initialize")),
          15_000,
        );
        setLspServerMessageHandler(({ rootPath, message }) => {
          if (rootPath !== root) return;
          if (message.id === 1 && message.result) {
            clearTimeout(timeout);
            resolve(message);
          }
        });

        sendLspMessage(root, {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            processId: null,
            rootUri: pathToFileURL(root).href,
            capabilities: {},
          },
        });
      });

      expect(response.result).toBeTruthy();

      sendLspMessage(root, { jsonrpc: "2.0", method: "initialized", params: {} });
      setLspServerMessageHandler(null);
    } finally {
      await stopAllTexlabSessions();
      await rm(root, { recursive: true, force: true });
    }
  });
});
