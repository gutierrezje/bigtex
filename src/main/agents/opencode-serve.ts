import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { relative, sep } from "node:path";
import {
  baseModelId,
  filterAgentModels,
  providerGroupFromModelId,
  sortReasoningVariants,
} from "../../shared/agent-models";
import { buildAgentSystemPrompt } from "../../shared/agent-prompt";
import type {
  AgentAvailability,
  AgentEvent,
  AgentModelOption,
  AgentRunInput,
  AgentRunSummary,
  AgentSessionConfig,
} from "../../shared/domain";
import type { AgentPermissionOption } from "../../shared/settings";
import { assertInsideRoot } from "../files/project";
import { resolveAgentPermission } from "../settings/permission-bridge";
import type { AgentBackend } from "./backend";
import { opencodeShellEnv, startOpencodeServe, stopOpencodeServe } from "./opencode-providers";
import { unifiedDiffFromTexts } from "./patch";

function notImplemented(): Error {
  return new Error("OpenCode serve backend is not implemented yet");
}

interface ServeModelInfo {
  name?: string;
  variants?: Record<string, unknown>;
}

interface ServeProvider {
  id: string;
  name?: string;
  models?: Record<string, ServeModelInfo>;
}

interface ServeProvidersResponse {
  providers: ServeProvider[];
  default?: Record<string, string>;
}

export interface ServeService {
  rootPath: string;
  baseUrl: string;
  child: Parameters<typeof stopOpencodeServe>[0];
  sessionId: string | null;
  eventAbort: AbortController | null;
  activeRun: ServeActiveRun | null;
  permissionSessionAllowed: boolean;
  resolvePermission: typeof resolveAgentPermission;
  postPermissionResponse: (
    sessionId: string,
    permissionId: string,
    response: ServePermissionResponse,
  ) => Promise<void>;
  fetchSessionDiff: (sessionId: string) => Promise<ServeFileDiff[]>;
}

interface ServeActiveRun {
  runId: string;
  sessionId: string;
  startedAt: number;
  emit: (event: AgentEvent) => void;
  textParts: Map<string, string>;
  emittedPatches: Set<string>;
}

interface ServeFileDiff {
  file?: string;
  path?: string;
  before?: string;
  after?: string;
  oldText?: string;
  newText?: string;
}

const serveServices = new Map<string, ServeService>();

const SERVE_PERMISSION_OPTIONS: AgentPermissionOption[] = [
  { optionId: "once", kind: "allow_once", name: "Allow once" },
  { optionId: "always", kind: "allow_session", name: "Allow for session" },
  { optionId: "reject", kind: "reject", name: "Deny" },
];

type ServePermissionResponse = "once" | "always" | "reject";

function splitCommand(commandLine: string): string[] {
  const tokens = commandLine.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return tokens.map((token) => token.replace(/^"|"$/g, ""));
}

function modelLabel(modelId: string, model: ServeModelInfo): string {
  return model.name ?? modelId;
}

function modelName(modelId: string, model: ServeModelInfo): string {
  const label = modelLabel(modelId, model);
  return label === modelId ? (modelId.split("/").at(-1) ?? modelId) : label;
}

function providerModelId(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

function serveUrl(service: ServeService, path: string, rootPath: string): string {
  return `${service.baseUrl}${path}?directory=${encodeURIComponent(rootPath)}`;
}

function buildModelOption(
  provider: ServeProvider,
  modelId: string,
  model: ServeModelInfo,
): AgentModelOption | null {
  const id = providerModelId(provider.id, modelId);
  const providerGroup = providerGroupFromModelId(id);
  if (providerGroup === "other") return null;
  return {
    id,
    name: modelName(modelId, model),
    label: modelLabel(modelId, model),
    providerGroup,
    variant: null,
  } satisfies AgentModelOption;
}

function defaultModelId(data: ServeProvidersResponse, models: AgentModelOption[]): string {
  const configuredDefaults = Object.entries(data.default ?? {})
    .map(([providerId, modelId]) => providerModelId(providerId, modelId))
    .filter((id) => models.some((model) => model.id === id));
  return configuredDefaults[0] ?? models[0]?.id ?? "";
}

export function parseServeProvidersConfig(data: ServeProvidersResponse): AgentSessionConfig {
  const models = filterAgentModels(
    data.providers.flatMap((provider) =>
      Object.entries(provider.models ?? {})
        .map(([modelId, model]) => buildModelOption(provider, modelId, model))
        .filter((model): model is AgentModelOption => model !== null),
    ),
  );
  const variantsByModel: Record<string, string[]> = {};

  for (const provider of data.providers) {
    if (providerGroupFromModelId(`${provider.id}/placeholder`) === "other") continue;
    for (const [modelId, model] of Object.entries(provider.models ?? {})) {
      const variants = sortReasoningVariants(Object.keys(model.variants ?? {}));
      if (variants.length > 0) {
        variantsByModel[providerModelId(provider.id, modelId)] = variants;
      }
    }
  }

  return {
    models,
    currentModelId: defaultModelId(data, models),
    availableVariants: [],
    currentVariant: null,
    variantsByModel,
  };
}

async function ensureServeService(rootPath: string): Promise<ServeService> {
  const existing = serveServices.get(rootPath);
  if (existing) return existing;

  const { port, child } = await startOpencodeServe(rootPath);
  const service: ServeService = {
    rootPath,
    baseUrl: `http://127.0.0.1:${port}`,
    child,
    sessionId: null,
    eventAbort: null,
    activeRun: null,
    permissionSessionAllowed: false,
    resolvePermission: resolveAgentPermission,
    postPermissionResponse: async (sessionId, permissionId, response) => {
      await postJson(
        service,
        rootPath,
        `/session/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(permissionId)}`,
        { response },
      );
    },
    fetchSessionDiff: async (sessionId) => {
      const response = await fetch(
        serveUrl(service, `/session/${encodeURIComponent(sessionId)}/diff`, rootPath),
      );
      if (!response.ok) {
        throw new Error(`OpenCode diff request failed (${response.status})`);
      }
      return (await response.json()) as ServeFileDiff[];
    },
  };
  serveServices.set(rootPath, service);
  child.on("exit", () => {
    const current = serveServices.get(rootPath);
    if (current?.child === child) serveServices.delete(rootPath);
  });
  return service;
}

async function fetchServeProviders(rootPath: string): Promise<ServeProvidersResponse> {
  const service = await ensureServeService(rootPath);
  const url = serveUrl(service, "/config/providers", rootPath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenCode providers request failed (${response.status})`);
  }
  return (await response.json()) as ServeProvidersResponse;
}

async function postJson<T>(
  service: ServeService,
  rootPath: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const response = await fetch(serveUrl(service, path, rootPath), {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OpenCode serve request failed (${response.status})`);
  }
  if (response.status === 204) return null;
  return (await response.json()) as T;
}

async function ensureServeSession(service: ServeService, rootPath: string): Promise<string> {
  if (service.sessionId) return service.sessionId;
  const session = await postJson<{ id?: string }>(service, rootPath, "/session", {
    title: "BigTeX",
  });
  if (!session?.id) throw new Error("OpenCode serve did not return a session id");
  service.sessionId = session.id;
  return session.id;
}

function concreteModelId(modelId: string, reasoningLevel: string | null): string {
  if (!reasoningLevel) return modelId;
  return `${baseModelId(modelId)}/${reasoningLevel}`;
}

export function splitServeModelId(modelId: string): { providerID: string; modelID: string } {
  const [providerID, ...modelParts] = modelId.split("/");
  return { providerID: providerID ?? "", modelID: modelParts.join("/") };
}

function eventType(event: Record<string, unknown>): string | null {
  return typeof event.type === "string" ? event.type : null;
}

function eventProperties(event: Record<string, unknown>): Record<string, unknown> {
  const properties = event.properties;
  return properties && typeof properties === "object"
    ? (properties as Record<string, unknown>)
    : event;
}

function eventSessionId(event: Record<string, unknown>): string | null {
  const properties = eventProperties(event);
  const sessionID = properties.sessionID ?? properties.sessionId;
  return typeof sessionID === "string" ? sessionID : null;
}

function permissionId(properties: Record<string, unknown>): string | null {
  const direct = properties.permissionID ?? properties.permissionId;
  if (typeof direct === "string") return direct;
  const permission = properties.permission;
  if (!permission || typeof permission !== "object") return null;
  const nested = (permission as Record<string, unknown>).id;
  return typeof nested === "string" ? nested : null;
}

function eventFilePath(properties: Record<string, unknown>): string | null {
  const file = properties.file;
  if (typeof file === "string") return file;
  if (file && typeof file === "object") {
    const path = stringField(file as Record<string, unknown>, ["path", "file"]);
    if (path) return path;
  }
  return stringField(properties, ["path", "file"]);
}

function normalizeServeFilePath(rootPath: string, filePath: string): string {
  const absolute = assertInsideRoot(rootPath, filePath);
  return relative(rootPath, absolute).split(sep).join("/");
}

function stringField(record: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string") return value;
  }
  return null;
}

function deltaText(properties: Record<string, unknown>): string | null {
  const delta = properties.delta;
  if (!delta || typeof delta !== "object") return null;
  return stringField(delta as Record<string, unknown>, ["text", "content"]);
}

function partText(record: Record<string, unknown>): string | null {
  const direct = stringField(record, ["text", "content"]);
  if (direct) return direct;

  const title = stringField(record, ["title", "name"]);
  const state = stringField(record, ["state", "status"]);
  if (!title && !state) return null;
  return `\n[tool${state ? `:${state}` : ""}] ${title ?? "Tool call"}\n`;
}

function chunkForPart(run: ServeActiveRun, properties: Record<string, unknown>): string | null {
  const part = properties.part;
  if (!part || typeof part !== "object") return null;
  const record = part as Record<string, unknown>;
  const delta = deltaText(properties);
  if (delta) return delta;

  const text = partText(record);
  if (!text) return null;

  const key =
    typeof record.id === "string"
      ? record.id
      : `${String(properties.messageID ?? properties.messageId ?? "message")}:text`;
  const previous = run.textParts.get(key) ?? "";
  run.textParts.set(key, text);
  return text.startsWith(previous) ? text.slice(previous.length) : text;
}

function eventForPartType(partType: unknown): "message" | "thought" | "activity" | null {
  if (partType === "text") return "message";
  if (typeof partType !== "string") return null;

  const normalized = partType.toLowerCase();
  if (normalized.includes("reason") || normalized.includes("think")) return "thought";
  if (normalized.includes("tool")) return "activity";
  return null;
}

function errorMessageFrom(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return stringField(record, ["message", "description", "name"]);
}

function eventErrorMessage(properties: Record<string, unknown>): string | null {
  return (
    errorMessageFrom(properties.error) ??
    errorMessageFrom((properties.message as Record<string, unknown> | undefined)?.error) ??
    errorMessageFrom(properties)
  );
}

function emitServeError(service: ServeService, run: ServeActiveRun, message: string): void {
  service.activeRun = null;
  run.emit({ type: "error", runId: run.runId, message, at: Date.now() });
  run.emit({
    type: "finished",
    runId: run.runId,
    exitCode: null,
    durationMs: Math.round(performance.now() - run.startedAt),
    at: Date.now(),
  });
}

export function servePermissionResponseForChoice(choice: string | null): ServePermissionResponse {
  if (choice === "always" || choice === "allow-session" || choice === "session") return "always";
  if (choice === "reject" || choice === "deny" || choice === null) return "reject";
  return "once";
}

async function handleServePermission(
  service: ServeService,
  run: ServeActiveRun,
  properties: Record<string, unknown>,
): Promise<void> {
  const id = permissionId(properties);
  if (!id) return;

  const permission = properties.permission;
  const permissionRecord =
    permission && typeof permission === "object" ? (permission as Record<string, unknown>) : {};
  const toolName =
    stringField(permissionRecord, ["tool", "toolName", "title", "name"]) ??
    stringField(properties, ["tool", "toolName", "title", "name"]) ??
    undefined;
  const path =
    stringField(permissionRecord, ["path", "file"]) ??
    stringField(properties, ["path", "file"]) ??
    undefined;

  const choice = await service.resolvePermission(
    run.runId,
    {
      options: SERVE_PERMISSION_OPTIONS,
      toolName,
      path,
    },
    service.permissionSessionAllowed,
  );
  const response = servePermissionResponseForChoice(choice);
  if (response === "always") service.permissionSessionAllowed = true;
  await service.postPermissionResponse(run.sessionId, id, response);
}

export function unifiedPatchFromServeDiffs(diffs: ServeFileDiff[]): string | null {
  const patches = diffs
    .map((diff) => {
      const file = diff.file ?? diff.path;
      if (!file) return "";
      return unifiedDiffFromTexts(
        file,
        diff.before ?? diff.oldText ?? "",
        diff.after ?? diff.newText ?? "",
      );
    })
    .filter(Boolean);
  return patches.length > 0 ? patches.join("\n\n") : null;
}

async function emitServePatch(service: ServeService, run: ServeActiveRun): Promise<void> {
  const patch = unifiedPatchFromServeDiffs(await service.fetchSessionDiff(run.sessionId));
  if (!patch || run.emittedPatches.has(patch)) return;
  run.emittedPatches.add(patch);
  run.emit({ type: "patch", runId: run.runId, patch, at: Date.now() });
}

export function handleServeEvent(service: ServeService, event: Record<string, unknown>): void {
  const type = eventType(event);
  const run = service.activeRun;
  if (!type || !run) return;

  const sessionId = eventSessionId(event);
  if (sessionId && sessionId !== run.sessionId) return;

  const properties = eventProperties(event);
  if (type === "message.part.updated") {
    const part = properties.part;
    const partType =
      part && typeof part === "object" ? (part as Record<string, unknown>).type : null;
    const eventKind = eventForPartType(partType);
    const chunk = chunkForPart(run, properties);
    if (eventKind && chunk) {
      run.emit({ type: eventKind, runId: run.runId, chunk, at: Date.now() } as AgentEvent);
    }
    return;
  }

  if (type === "message.updated" || type === "session.error") {
    const message = eventErrorMessage(properties);
    if (message) emitServeError(service, run, message);
    return;
  }

  if (type === "permission.updated") {
    void handleServePermission(service, run, properties).catch((error) => {
      emitServeError(
        service,
        run,
        error instanceof Error ? error.message : "OpenCode permission response failed",
      );
    });
    return;
  }

  if (type === "file.edited") {
    const path = eventFilePath(properties);
    if (path) {
      try {
        run.emit({
          type: "filesChanged",
          runId: run.runId,
          paths: [normalizeServeFilePath(service.rootPath, path)],
          at: Date.now(),
        });
      } catch (error) {
        run.emit({
          type: "stderr",
          runId: run.runId,
          chunk: `${error instanceof Error ? error.message : "Invalid edited file path"}\n`,
          at: Date.now(),
        });
      }
    }
    void emitServePatch(service, run).catch((error) => {
      run.emit({
        type: "stderr",
        runId: run.runId,
        chunk: `${error instanceof Error ? error.message : "OpenCode diff request failed"}\n`,
        at: Date.now(),
      });
    });
    return;
  }

  if (type === "session.diff") {
    void emitServePatch(service, run).catch((error) => {
      run.emit({
        type: "stderr",
        runId: run.runId,
        chunk: `${error instanceof Error ? error.message : "OpenCode diff request failed"}\n`,
        at: Date.now(),
      });
    });
    return;
  }

  if (type === "session.idle") {
    service.activeRun = null;
    run.emit({
      type: "finished",
      runId: run.runId,
      exitCode: 0,
      durationMs: Math.round(performance.now() - run.startedAt),
      at: Date.now(),
    });
  }
}

async function subscribeServeEvents(service: ServeService, rootPath: string): Promise<void> {
  if (service.eventAbort) return;
  const abort = new AbortController();
  service.eventAbort = abort;

  void (async () => {
    try {
      const response = await fetch(serveUrl(service, "/event", rootPath), {
        signal: abort.signal,
        headers: { Accept: "text/event-stream" },
      });
      if (!response.ok || !response.body) {
        throw new Error(`OpenCode event stream failed (${response.status})`);
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += value;

        while (true) {
          const separator = buffer.indexOf("\n\n");
          if (separator === -1) break;
          const rawEvent = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          const data = rawEvent
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!data) continue;
          try {
            handleServeEvent(service, JSON.parse(data) as Record<string, unknown>);
          } catch {
            // Ignore malformed stream events; later slices will surface stream errors.
          }
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        service.eventAbort = null;
        const run = service.activeRun;
        if (run) {
          service.activeRun = null;
          run.emit({
            type: "error",
            runId: run.runId,
            message: error instanceof Error ? error.message : "OpenCode event stream failed",
            at: Date.now(),
          });
          run.emit({
            type: "finished",
            runId: run.runId,
            exitCode: null,
            durationMs: Math.round(performance.now() - run.startedAt),
            at: Date.now(),
          });
        }
      }
    }
  })();
}

export const serveAgentBackend: AgentBackend & { id: "serve" } = {
  id: "serve",

  async check(commandLine = "opencode"): Promise<AgentAvailability> {
    const [command, ...args] = splitCommand(commandLine);

    return new Promise((resolve) => {
      const child = spawn(command ?? "opencode", [...args, "--version"], {
        shell: false,
        env: opencodeShellEnv(),
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
  },

  async loadConfig(rootPath: string): Promise<AgentSessionConfig> {
    return parseServeProvidersConfig(await fetchServeProviders(rootPath));
  },

  async probeModelVariants(rootPath: string, modelId: string): Promise<string[]> {
    const config = parseServeProvidersConfig(await fetchServeProviders(rootPath));
    return config.variantsByModel[modelId] ?? [];
  },

  async run(input: AgentRunInput, emit: (event: AgentEvent) => void): Promise<AgentRunSummary> {
    const service = await ensureServeService(input.rootPath);
    const sessionId = await ensureServeSession(service, input.rootPath);
    await subscribeServeEvents(service, input.rootPath);

    const runId = randomUUID();
    const startedAt = performance.now();
    service.activeRun = {
      runId,
      sessionId,
      startedAt,
      emit,
      textParts: new Map(),
      emittedPatches: new Set(),
    };
    emit({ type: "started", runId, command: "opencode serve", at: Date.now() });

    const model = splitServeModelId(concreteModelId(input.modelId, input.reasoningLevel));
    await postJson(
      service,
      input.rootPath,
      `/session/${encodeURIComponent(sessionId)}/prompt_async`,
      {
        model,
        parts: [
          {
            type: "text",
            text: buildAgentSystemPrompt({
              selectedFiles: input.selectedFiles,
              compileSummary: input.compileSummary,
              prompt: input.prompt,
            }),
          },
        ],
      },
    );

    return { runId };
  },

  async cancel(_runId: string): Promise<void> {
    throw notImplemented();
  },

  clearSession(rootPath: string): void {
    const service = serveServices.get(rootPath);
    if (!service) return;
    serveServices.delete(rootPath);
    service.eventAbort?.abort();
    stopOpencodeServe(service.child);
  },
};
