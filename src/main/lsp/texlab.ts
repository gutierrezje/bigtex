import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { resolve } from "node:path";
import type { LanguageServerAvailability, LanguageServerSessionStatus } from "../../shared/domain";
import {
  isLspJsonRpcMessage,
  type LspJsonRpcMessage,
  type LspServerMessageEvent,
} from "../../shared/lsp";
import { formatLspMessage, LspMessageReader } from "./framing";

const DEFAULT_TEXLAB_COMMAND = "texlab";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type ServerMessageHandler = (event: LspServerMessageEvent) => void;

let serverMessageHandler: ServerMessageHandler | null = null;

export function setLspServerMessageHandler(handler: ServerMessageHandler | null): void {
  serverMessageHandler = handler;
}

function emitServerMessage(rootPath: string, message: LspJsonRpcMessage): void {
  serverMessageHandler?.({ rootPath, message });
}

class LspConnection {
  /** Renderer-proxied requests use low ids; main reserves high ids for shutdown. */
  private nextId = 10_000;
  private readonly reader = new LspMessageReader();
  private readonly pending = new Map<
    number,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();
  private onServerMessage: ((message: LspJsonRpcMessage) => void) | null = null;

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

  setServerMessageHandler(handler: ((message: LspJsonRpcMessage) => void) | null): void {
    this.onServerMessage = handler;
  }

  write(message: LspJsonRpcMessage): void {
    this.child.stdin.write(formatLspMessage(message), "utf8");
  }

  /** Internal requests used for session shutdown (not proxied from renderer). */
  async request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.write(payload);
    return promise;
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
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

    const message = parsed as LspJsonRpcMessage;
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        const response = message as unknown as JsonRpcResponse;
        if (response.error) {
          pending.reject(new Error(response.error.message));
          return;
        }
        pending.resolve(response.result);
        return;
      }
    }

    this.onServerMessage?.(message);
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
    this.connection.setServerMessageHandler((message) => {
      emitServerMessage(this.rootPath, message);
    });

    this.child.on("error", (error) => {
      this.connection.rejectAll(error);
    });
  }

  send(message: LspJsonRpcMessage): void {
    if (this.stopped) {
      throw new Error("LSP session is not active");
    }
    this.connection.write(message);
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
    this.connection.setServerMessageHandler(null);

    try {
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

function requireSession(rootPath: string): TexlabSession {
  const session = sessions.get(sessionKey(rootPath));
  if (!session) {
    throw new Error("No active language server session for this project");
  }
  return session;
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
    sessions.set(key, session);
    return session.status();
  } catch (error) {
    await session.stop();
    sessions.delete(key);
    return {
      active: false,
      rootPath: key,
      mainFile,
      command: commandLine,
      message: error instanceof Error ? error.message : "Failed to start texlab session",
    };
  }
}

export function sendLspMessage(rootPath: string, message: LspJsonRpcMessage): void {
  if (!isLspJsonRpcMessage(message)) {
    throw new Error("Invalid LSP JSON-RPC message");
  }
  requireSession(rootPath).send(message);
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
