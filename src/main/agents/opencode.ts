import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import {
  baseModelId,
  pickDefaultModel,
  REASONING_VARIANT_PROBE_CANDIDATES,
  sortReasoningVariants,
  withModelVariants,
} from "../../shared/agent-models";
import type {
  AgentAvailability,
  AgentEvent,
  AgentRunInput,
  AgentRunSummary,
  AgentSessionConfig,
} from "../../shared/domain";
import { assertInsideRoot } from "../files/project";
import { startProjectWatch } from "../files/watch";
import {
  type AcpSessionNewResult,
  type AcpSetConfigOptionResult,
  mergeAgentSessionConfig,
  parseAgentSessionConfig,
  resolveModelIdForRun,
} from "./acp-config";
import {
  getOpencodeVariantsByModel,
  getVariantsForModel,
  opencodeShellEnv,
} from "./opencode-providers";
import { unifiedDiffFromTexts } from "./patch";

const PATCH_BLOCK_PATTERN = /```(?:diff|patch)\s*\n([\s\S]*?)```/gi;
const OPENCODE_ACP_COMMAND = "opencode";
const OPENCODE_ACP_ARGS = ["acp"] as const;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface ActiveAcpRun {
  child: ChildProcessWithoutNullStreams;
  sessionId: string | null;
  stopWatch: () => void;
}

const activeRuns = new Map<string, ActiveAcpRun>();

function splitCommand(commandLine: string): string[] {
  const tokens = commandLine.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return tokens.map((token) => token.replace(/^"|"$/g, ""));
}

function agentSystemPrompt(input: AgentRunInput): string {
  const diagnostics = input.diagnostics
    .slice(0, 12)
    .map((diagnostic) => {
      const location = [diagnostic.file, diagnostic.line].filter(Boolean).join(":");
      return `- ${diagnostic.severity.toUpperCase()} ${location || "project"}: ${diagnostic.message}`;
    })
    .join("\n");

  return [
    "You are editing a local LaTeX project from inside BigTeX.",
    "Prefer precise, small patches. Do not rewrite unrelated files.",
    "When changing files, respond with one or more fenced diff blocks using unified diff format.",
    "Do not apply changes yourself unless the user explicitly asks through the host app.",
    input.selectedFiles.length > 0
      ? `Selected files:\n${input.selectedFiles.map((file) => `- ${file}`).join("\n")}`
      : "No files are selected.",
    diagnostics
      ? `Current compile diagnostics:\n${diagnostics}`
      : "No compile diagnostics are loaded.",
    `User request:\n${input.prompt}`,
  ].join("\n\n");
}

function extractPatch(text: string): string | null {
  const patches: string[] = [];
  for (const match of text.matchAll(PATCH_BLOCK_PATTERN)) {
    patches.push(match[1].trim());
  }
  return patches.length > 0 ? patches.join("\n\n") : null;
}

function toProjectRelative(rootPath: string, filePath: string): string {
  const root = resolve(rootPath);
  const absolute = filePath.startsWith("/") ? resolve(filePath) : resolve(root, filePath);
  return relative(root, absolute).split(sep).join("/");
}

function patchFromToolCallUpdate(update: Record<string, unknown>, rootPath: string): string | null {
  const content = update.content;
  if (!Array.isArray(content)) return null;

  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const block = item as { type?: unknown; path?: unknown; oldText?: unknown; newText?: unknown };
    if (block.type !== "diff" || typeof block.path !== "string") continue;

    const oldText = typeof block.oldText === "string" ? block.oldText : "";
    const newText = typeof block.newText === "string" ? block.newText : "";
    const relativePath = toProjectRelative(rootPath, block.path);
    const patch = unifiedDiffFromTexts(relativePath, oldText, newText);
    if (patch) return patch;
  }

  return null;
}

function textFromAcpContent(content: unknown): string | null {
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

function acpPrompt(input: AgentRunInput): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text: agentSystemPrompt(input) }];
}

function handleAcpNotification(
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

  if (updateKind === "agent_message_chunk" || updateKind === "agent_thought_chunk") {
    const text = textFromAcpContent(update.content);
    if (!text) return;

    appendTranscript(text);
    emit({ type: "stdout", runId, chunk: text, at: Date.now() });
    return;
  }

  if (updateKind === "tool_call") {
    const title = typeof update.title === "string" ? update.title : "Tool call";
    const chunk = `\n\n[tool] ${title}\n`;
    appendTranscript(chunk);
    emit({ type: "stdout", runId, chunk, at: Date.now() });
    return;
  }

  if (updateKind === "tool_call_update") {
    const title = typeof update.title === "string" ? update.title : "Tool update";
    const status = typeof update.status === "string" ? update.status : "updated";
    const chunk = `\n[tool:${status}] ${title}\n`;
    appendTranscript(chunk);
    emit({ type: "stdout", runId, chunk, at: Date.now() });

    if (status === "completed") {
      const patch = patchFromToolCallUpdate(update, rootPath);
      if (patch) {
        emit({ type: "patch", runId, patch, at: Date.now() });
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
      emit({ type: "stdout", runId, chunk: planText, at: Date.now() });
    }
  }
}

class AcpConnection {
  private nextId = 1;
  private buffer = "";
  private pending = new Map<
    number,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();

  constructor(
    private child: ChildProcessWithoutNullStreams,
    private runId: string,
    private rootPath: string,
    private emit: (event: AgentEvent) => void,
    private appendTranscript: (text: string) => void,
  ) {
    child.stdout.on("data", (chunk: Buffer) => {
      this.consume(chunk.toString("utf8"));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      emit({ type: "stderr", runId, chunk: text, at: Date.now() });
    });
  }

  request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const message: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };

    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });

    this.write(message);
    return promise;
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  private write(message: JsonRpcRequest | JsonRpcNotification | JsonRpcResponse): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private consume(text: string): void {
    this.buffer += text;

    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex === -1) return;

      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      this.handleMessage(line);
    }
  }

  private handleMessage(line: string): void {
    let message: JsonRpcResponse | JsonRpcNotification | JsonRpcRequest;

    try {
      message = JSON.parse(line);
    } catch {
      this.emit({
        type: "stderr",
        runId: this.runId,
        chunk: `Invalid ACP JSON: ${line}\n`,
        at: Date.now(),
      });
      return;
    }

    if ("id" in message && ("result" in message || "error" in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if ("method" in message && !("id" in message)) {
      handleAcpNotification(message, this.runId, this.rootPath, this.appendTranscript, this.emit);
      return;
    }

    if ("method" in message && "id" in message) {
      void this.handleClientRequest(message);
    }
  }

  private async handleClientRequest(message: JsonRpcRequest): Promise<void> {
    try {
      const result = await this.resolveClientRequest(message.method, message.params);
      this.write({ jsonrpc: "2.0", id: message.id, result });
    } catch (error) {
      this.write({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "ACP client request failed",
        },
      });
    }
  }

  private async resolveClientRequest(method: string, params: unknown): Promise<unknown> {
    if (method === "session/request_permission") {
      const request = params as {
        options?: Array<{ optionId?: string; kind?: string }>;
      };
      const allowOption =
        request.options?.find((option) => option.kind?.startsWith("allow")) ??
        request.options?.find((option) => option.optionId === "once");

      return {
        outcome: {
          outcome: "selected",
          optionId: allowOption?.optionId ?? "once",
        },
      };
    }

    if (method === "fs/read_text_file") {
      const request = params as { path?: unknown; line?: unknown; limit?: unknown };
      if (typeof request.path !== "string") throw new Error("Missing path");
      const absolutePath = assertInsideRoot(this.rootPath, request.path);
      const content = await readFile(absolutePath, "utf8");
      const lines = content.split(/\r?\n/);
      const start = typeof request.line === "number" && request.line > 0 ? request.line - 1 : 0;
      const limit =
        typeof request.limit === "number" && request.limit > 0 ? request.limit : lines.length;
      return { content: lines.slice(start, start + limit).join("\n") };
    }

    if (method === "fs/write_text_file") {
      const request = params as { path?: unknown; content?: unknown };
      if (typeof request.path !== "string") throw new Error("Missing path");
      if (typeof request.content !== "string") throw new Error("Missing content");
      const absolutePath = assertInsideRoot(this.rootPath, request.path);
      await writeFile(absolutePath, request.content, "utf8");
      const relativePath = toProjectRelative(this.rootPath, request.path);
      this.emit({
        type: "filesChanged",
        runId: this.runId,
        paths: [relativePath],
        at: Date.now(),
      });
      return {};
    }

    throw new Error(`Unsupported ACP client method: ${method}`);
  }
}

const ACP_INITIALIZE_PARAMS = {
  protocolVersion: 1,
  clientCapabilities: {
    fs: {
      readTextFile: true,
      writeTextFile: true,
    },
    terminal: false,
  },
  clientInfo: {
    name: "bigtex",
    title: "BigTeX",
    version: "0.1.0",
  },
} as const;

function currentModelFromSetResult(result: AcpSetConfigOptionResult | null): string | null {
  const modelOption = result?.configOptions?.find((option) => option.id === "model");
  return modelOption?.currentValue ?? null;
}

async function discoverModelVariantsViaAcp(
  connection: AcpConnection,
  sessionId: string,
  modelId: string,
): Promise<string[]> {
  const base = baseModelId(modelId);
  const valid: string[] = [];

  for (const variant of REASONING_VARIANT_PROBE_CANDIDATES) {
    const candidate = `${base}/${variant}`;
    try {
      const result = await connection.request<AcpSetConfigOptionResult>(
        "session/set_config_option",
        {
          sessionId,
          configId: "model",
          value: candidate,
        },
      );
      if (currentModelFromSetResult(result) === candidate) {
        valid.push(variant);
      }
    } catch {
      // Variant not supported for this model.
    }
  }

  await applySessionModel(connection, sessionId, base);
  return sortReasoningVariants(valid);
}

async function applySessionModel(
  connection: AcpConnection,
  sessionId: string,
  modelId: string,
): Promise<AcpSetConfigOptionResult | null> {
  try {
    return await connection.request<AcpSetConfigOptionResult>("session/set_config_option", {
      sessionId,
      configId: "model",
      value: modelId,
    });
  } catch {
    // Older OpenCode builds expose unstable_setSessionModel instead.
  }

  await connection.request("session/set_model", { sessionId, modelId });
  return null;
}

async function withOpencodeAcpSession<T>(
  rootPath: string,
  run: (connection: AcpConnection, session: AcpSessionNewResult) => Promise<T>,
): Promise<T> {
  const child = spawn(OPENCODE_ACP_COMMAND, [...OPENCODE_ACP_ARGS], {
    cwd: rootPath,
    shell: false,
    env: opencodeShellEnv(),
  });

  const connection = new AcpConnection(
    child,
    "config",
    rootPath,
    () => {},
    () => {},
  );

  try {
    await connection.request("initialize", ACP_INITIALIZE_PARAMS);
    const session = await connection.request<AcpSessionNewResult>("session/new", {
      cwd: rootPath,
      mcpServers: [],
    });
    return await run(connection, session);
  } finally {
    child.stdin.end();
    child.kill("SIGTERM");
  }
}

export async function probeOpencodeModelVariants(
  rootPath: string,
  modelId: string,
): Promise<string[]> {
  try {
    return await getVariantsForModel(rootPath, modelId);
  } catch {
    const base = baseModelId(modelId);
    return withOpencodeAcpSession(rootPath, async (connection, session) =>
      discoverModelVariantsViaAcp(connection, session.sessionId, base),
    );
  }
}

export async function loadOpencodeSessionConfig(rootPath: string): Promise<AgentSessionConfig> {
  return withOpencodeAcpSession(rootPath, async (connection, session) => {
    let config = parseAgentSessionConfig(session);
    const probeModelId = baseModelId(config.currentModelId) || pickDefaultModel(config, "free");
    const refreshed = await applySessionModel(connection, session.sessionId, probeModelId);
    if (refreshed) {
      config = mergeAgentSessionConfig(config, refreshed);
    }

    try {
      const variantsByModel = await getOpencodeVariantsByModel(rootPath, { force: true });
      return { ...config, variantsByModel };
    } catch {
      const variants = await discoverModelVariantsViaAcp(
        connection,
        session.sessionId,
        probeModelId,
      );
      return withModelVariants(config, probeModelId, variants);
    }
  });
}

export async function checkOpencode(commandLine = "opencode"): Promise<AgentAvailability> {
  const [command, ...args] = splitCommand(commandLine);

  return new Promise((resolve) => {
    const child = spawn(command ?? "opencode", [...args, "--version"], {
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
        message:
          text || (exitCode === 0 ? "opencode is available." : "opencode returned an error."),
      });
    });
  });
}

export async function runOpencode(
  input: AgentRunInput,
  emit: (event: AgentEvent) => void,
): Promise<AgentRunSummary> {
  const runId = randomUUID();
  const command = OPENCODE_ACP_COMMAND;
  const args = [...OPENCODE_ACP_ARGS];
  const startedAt = performance.now();
  let transcript = "";

  for (const file of input.selectedFiles) {
    assertInsideRoot(input.rootPath, file);
  }

  const child = spawn(command, args, {
    cwd: input.rootPath,
    shell: false,
    env: opencodeShellEnv(),
  });

  const stopWatch = startProjectWatch(input.rootPath, runId, emit);
  activeRuns.set(runId, { child, sessionId: null, stopWatch });

  emit({
    type: "started",
    runId,
    command: `${command} ${args.join(" ")}`,
    at: Date.now(),
  });

  const connection = new AcpConnection(child, runId, input.rootPath, emit, (text) => {
    transcript += text;
  });

  child.on("error", (error) => {
    emit({ type: "error", runId, message: error.message, at: Date.now() });
  });

  child.on("close", (exitCode) => {
    activeRuns.get(runId)?.stopWatch();
    activeRuns.delete(runId);
    const patch = extractPatch(transcript);
    if (patch) {
      emit({ type: "patch", runId, patch, at: Date.now() });
    }
    emit({
      type: "finished",
      runId,
      exitCode,
      durationMs: Math.round(performance.now() - startedAt),
      at: Date.now(),
    });
  });

  void (async () => {
    try {
      await connection.request("initialize", ACP_INITIALIZE_PARAMS);

      const session = await connection.request<AcpSessionNewResult>("session/new", {
        cwd: input.rootPath,
        mcpServers: [],
      });

      const active = activeRuns.get(runId);
      if (active) active.sessionId = session.sessionId;

      const sessionConfig = parseAgentSessionConfig(session);
      const modelId = resolveModelIdForRun(sessionConfig, input.modelId, input.reasoningLevel);
      if (modelId && modelId !== sessionConfig.currentModelId) {
        await applySessionModel(connection, session.sessionId, modelId);
      }

      await connection.request("session/prompt", {
        sessionId: session.sessionId,
        prompt: acpPrompt(input),
      });

      // OpenCode may emit session/update notifications after the prompt RPC returns.
      await new Promise((resolve) => setTimeout(resolve, 750));
      child.stdin.end();
    } catch (error) {
      emit({
        type: "error",
        runId,
        message: error instanceof Error ? error.message : "ACP run failed",
        at: Date.now(),
      });
      child.kill("SIGTERM");
    }
  })();

  return { runId };
}

export async function cancelOpencode(runId: string): Promise<void> {
  const active = activeRuns.get(runId);
  if (!active) return;

  active.stopWatch();
  active.child.kill("SIGTERM");
  activeRuns.delete(runId);
}
