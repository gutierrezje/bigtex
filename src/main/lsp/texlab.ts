import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { LanguageServerAvailability, LanguageServerSessionStatus } from "../../shared/domain";
import { formatLspMessage, LspMessageReader } from "./framing";

const DEFAULT_TEXLAB_COMMAND = "texlab";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

class LspConnection {
  private nextId = 1;
  private readonly reader = new LspMessageReader();
  private readonly pending = new Map<
    number,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    child.stdout.on("data", (chunk: Buffer) => {
      for (const body of this.reader.push(chunk.toString("utf8"))) {
        this.onMessage(body);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();
      if (text) console.error(`[texlab] ${text}`);
    });
  }

  async request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.child.stdin.write(formatLspMessage(payload), "utf8");
    return promise;
  }

  notify(method: string, params?: unknown): void {
    this.child.stdin.write(formatLspMessage({ jsonrpc: "2.0", method, params }), "utf8");
  }

  private onMessage(body: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      console.error("[texlab] Invalid JSON-RPC payload");
      return;
    }

    if (!parsed || typeof parsed !== "object") return;

    const message = parsed as Record<string, unknown>;
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);

      const response = message as unknown as JsonRpcResponse;
      if (response.error) {
        pending.reject(new Error(response.error.message));
        return;
      }
      pending.resolve(response.result);
      return;
    }

    // Server-initiated notifications (e.g. publishDiagnostics) — handled in step 2.
    if (typeof message.method === "string") {
      return;
    }
  }

  rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

class TexlabSession {
  readonly rootPath: string;
  readonly mainFile: string | null;
  readonly command: string;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly connection: LspConnection;
  private readonly ready: Promise<void>;
  private stopped = false;

  constructor(rootPath: string, mainFile: string | null, command: string) {
    this.rootPath = resolve(rootPath);
    this.mainFile = mainFile;
    this.command = command;
    this.child = spawn(command, [], {
      cwd: this.rootPath,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.connection = new LspConnection(this.child);
    this.ready = this.initialize();

    this.child.on("error", (error) => {
      this.connection.rejectAll(error);
    });
  }

  private async initialize(): Promise<void> {
    const rootUri = pathToFileURL(this.rootPath).href;
    await this.connection.request("initialize", {
      processId: process.pid,
      rootUri,
      capabilities: {},
      workspaceFolders: [{ uri: rootUri, name: basename(this.rootPath) }],
    });
    this.connection.notify("initialized", {});

    if (this.mainFile) {
      this.connection.notify("workspace/didChangeConfiguration", {
        settings: {
          texlab: {
            rootDirectory: this.rootPath,
          },
        },
      });
    }
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  status(): LanguageServerSessionStatus {
    return {
      active: !this.stopped && !this.child.killed,
      rootPath: this.rootPath,
      mainFile: this.mainFile,
      command: this.command,
      message: null,
    };
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;

    try {
      await this.ready;
      await this.connection.request("shutdown", null);
      this.connection.notify("exit", null);
    } catch {
      // Process may already be gone.
    }

    if (!this.child.killed) {
      this.child.kill("SIGTERM");
    }
  }
}

const sessions = new Map<string, TexlabSession>();

function sessionKey(rootPath: string): string {
  return resolve(rootPath);
}

export function splitCommand(commandLine: string): string[] {
  const tokens = commandLine.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return tokens.map((token) => token.replace(/^"|"$/g, ""));
}

export async function checkTexlab(
  commandLine = DEFAULT_TEXLAB_COMMAND,
): Promise<LanguageServerAvailability> {
  const [command, ...args] = splitCommand(commandLine);

  return new Promise((resolve) => {
    const child = spawn(command ?? DEFAULT_TEXLAB_COMMAND, [...args, "--version"], {
      shell: false,
    });

    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({
        available: false,
        command: commandLine,
        version: null,
        message: error.message,
      });
    });
    child.on("close", (exitCode) => {
      const text = output.trim();
      resolve({
        available: exitCode === 0,
        command: commandLine,
        version: exitCode === 0 ? text.split(/\r?\n/)[0] : null,
        message: text || (exitCode === 0 ? "texlab is available." : "texlab returned an error."),
      });
    });
  });
}

export async function startTexlabSession(
  rootPath: string,
  mainFile: string | null,
  commandLine = DEFAULT_TEXLAB_COMMAND,
): Promise<LanguageServerSessionStatus> {
  const key = sessionKey(rootPath);
  const existing = sessions.get(key);
  if (existing) {
    await existing.stop();
    sessions.delete(key);
  }

  const [command] = splitCommand(commandLine);
  const session = new TexlabSession(rootPath, mainFile, command ?? DEFAULT_TEXLAB_COMMAND);

  try {
    await session.waitUntilReady();
    sessions.set(key, session);
    return session.status();
  } catch (error) {
    await session.stop();
    return {
      active: false,
      rootPath: key,
      mainFile,
      command: commandLine,
      message: error instanceof Error ? error.message : "Failed to start texlab session",
    };
  }
}

export async function stopTexlabSession(rootPath: string): Promise<void> {
  const key = sessionKey(rootPath);
  const session = sessions.get(key);
  if (!session) return;
  sessions.delete(key);
  await session.stop();
}

export function getTexlabSessionStatus(rootPath: string): LanguageServerSessionStatus | null {
  const session = sessions.get(sessionKey(rootPath));
  if (!session) return null;
  return session.status();
}

export async function stopAllTexlabSessions(): Promise<void> {
  const stopping = [...sessions.values()].map((session) => session.stop());
  sessions.clear();
  await Promise.all(stopping);
}
