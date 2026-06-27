import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { relative, sep } from "node:path";
import { createOpencodeClient, type FileDiff, type OpencodeClient } from "@opencode-ai/sdk";
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

type OpenCodeResult<T> = { data?: T; error?: unknown };

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
  client: OpencodeClient;
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
  fetchSessionDiff: (sessionId: string) => Promise<FileDiff[]>;
  abortSession: (sessionId: string) => Promise<void>;
}

interface ServeActiveRun {
  runId: string;
  sessionId: string;
  startedAt: number;
  emit: (event: AgentEvent) => void;
  textParts: Map<string, string>;
  emittedPatches: Set<string>;
}

const serveServices = new Map<string, ServeService>();
const serveStartPromises = new Map<string, Promise<ServeService>>();

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
  if (!Array.isArray(data.providers)) {
    throw new Error("OpenCode providers response is missing a providers array");
  }
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

async function startServeService(rootPath: string): Promise<ServeService> {
  const { port, child } = await startOpencodeServe(rootPath);
  const baseUrl = `http://127.0.0.1:${port}`;
  const client = createOpencodeClient({ baseUrl });
  const service: ServeService = {
    rootPath,
    baseUrl,
    client,
    child,
    sessionId: null,
    eventAbort: null,
    activeRun: null,
    permissionSessionAllowed: false,
    resolvePermission: resolveAgentPermission,
    postPermissionResponse: async (sessionId, permissionId, response) => {
      await unwrapOpenCodeResult(
        await client.postSessionIdPermissionsPermissionId({
          path: { id: sessionId, permissionID: permissionId },
          body: { response },
        }),
        "OpenCode permission response",
        { allowEmptyData: true },
      );
    },
    fetchSessionDiff: async (sessionId) => {
      return unwrapOpenCodeResult(
        await client.session.diff({
          path: { id: sessionId },
          query: { directory: rootPath },
        }),
        "OpenCode diff request",
      );
    },
    abortSession: async (sessionId) => {
      await unwrapOpenCodeResult(
        await client.session.abort({
          path: { id: sessionId },
          query: { directory: rootPath },
        }),
        "OpenCode abort request",
        { allowEmptyData: true },
      );
    },
  };
  serveServices.set(rootPath, service);
  child.on("exit", () => {
    const current = serveServices.get(rootPath);
    if (current?.child === child) {
      serveServices.delete(rootPath);
      finishServeRunWithError(current, "OpenCode serve exited");
    }
  });
  return service;
}

async function ensureServeService(rootPath: string): Promise<ServeService> {
  const existing = serveServices.get(rootPath);
  if (existing) return existing;

  const inFlight = serveStartPromises.get(rootPath);
  if (inFlight) return inFlight;

  const startPromise = startServeService(rootPath).finally(() => {
    serveStartPromises.delete(rootPath);
  });
  serveStartPromises.set(rootPath, startPromise);
  return startPromise;
}

async function fetchServeProviders(rootPath: string): Promise<ServeProvidersResponse> {
  const service = await ensureServeService(rootPath);
  return unwrapOpenCodeResult(
    await service.client.config.providers({ query: { directory: rootPath } }),
    "OpenCode providers request",
  );
}

function unwrapOpenCodeResult<T>(
  result: OpenCodeResult<T>,
  label: string,
  options?: { allowEmptyData?: boolean },
): T {
  if (result.error) {
    throw new Error(`${label} failed: ${describeOpenCodeError(result.error)}`);
  }
  if (result.data === undefined && !options?.allowEmptyData) {
    throw new Error(`${label} returned no data`);
  }
  return result.data as T;
}

function describeOpenCodeError(error: unknown): string {
  if (typeof error === "string" && error.trim() !== "") return error;
  if (!error || typeof error !== "object") return "unknown error";
  const record = error as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? record.data : undefined;
  return (
    stringField((data as Record<string, unknown> | undefined) ?? record, [
      "message",
      "description",
      "name",
    ]) ?? "unknown error"
  );
}

async function ensureServeSession(service: ServeService, rootPath: string): Promise<string> {
  if (service.sessionId) return service.sessionId;
  const session = unwrapOpenCodeResult(
    await service.client.session.create({
      query: { directory: rootPath },
      body: { title: "BigTeX" },
    }),
    "OpenCode session creation",
  );
  if (!session.id) throw new Error("OpenCode serve did not return a session id");
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

function serveEventPayload(event: unknown): Record<string, unknown> | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  const payload = record.payload;
  if (payload && typeof payload === "object") return payload as Record<string, unknown>;
  return record;
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

function eventErrorMessage(eventType: string, properties: Record<string, unknown>): string | null {
  return (
    errorMessageFrom(properties.error) ??
    errorMessageFrom((properties.message as Record<string, unknown> | undefined)?.error) ??
    (eventType === "session.error" ? errorMessageFrom(properties) : null)
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

function finishServeRunWithError(service: ServeService, message: string): void {
  const run = service.activeRun;
  if (!run) return;
  emitServeError(service, run, message);
}

function finishServeRun(service: ServeService, run: ServeActiveRun, exitCode: number | null): void {
  if (service.activeRun === run) service.activeRun = null;
  run.emit({
    type: "finished",
    runId: run.runId,
    exitCode,
    durationMs: Math.round(performance.now() - run.startedAt),
    at: Date.now(),
  });
}

export async function cancelServeRunInService(
  service: ServeService,
  runId: string,
): Promise<boolean> {
  const run = service.activeRun;
  if (!run || run.runId !== runId) return false;
  service.activeRun = null;
  try {
    await service.abortSession(run.sessionId);
  } catch {
    // Still finish the run so the UI does not hang when abort fails.
  }
  finishServeRun(service, run, null);
  return true;
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
  if (!id) {
    throw new Error("OpenCode permission.updated event is missing a permission id");
  }

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
  await service.postPermissionResponse(run.sessionId, id, response);
  if (response === "always") service.permissionSessionAllowed = true;
}

export function unifiedPatchFromServeDiffs(diffs: FileDiff[]): string | null {
  const patches = diffs
    .map((diff) => {
      const file = diff.file;
      if (!file) return "";
      return unifiedDiffFromTexts(file, diff.before, diff.after);
    })
    .filter(Boolean);
  return patches.length > 0 ? patches.join("\n\n") : null;
}

async function emitServePatch(service: ServeService, run: ServeActiveRun): Promise<void> {
  const patch = unifiedPatchFromServeDiffs(await service.fetchSessionDiff(run.sessionId));
  if (!patch || run.emittedPatches.has(patch)) return;
  run.emittedPatches.add(patch);
  run.emit({
    type: "patch",
    runId: run.runId,
    patch,
    status: "applied",
    source: "opencode-session",
    at: Date.now(),
  });
}

export function handleServeEvent(service: ServeService, event: unknown): void {
  const payload = serveEventPayload(event);
  if (!payload) return;

  const type = eventType(payload);
  const run = service.activeRun;
  if (!type || !run) return;

  const sessionId = eventSessionId(payload);
  if (sessionId && sessionId !== run.sessionId) return;

  const properties = eventProperties(payload);
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
    const message = eventErrorMessage(type, properties);
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
    finishServeRun(service, run, 0);
  }
}

async function subscribeServeEvents(service: ServeService, rootPath: string): Promise<void> {
  if (service.eventAbort) return;
  const abort = new AbortController();
  service.eventAbort = abort;

  void (async () => {
    try {
      const sse = await service.client.event.subscribe({
        signal: abort.signal,
        query: { directory: rootPath },
      });

      for await (const event of sse.stream) {
        handleServeEvent(service, event);
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
    await unwrapOpenCodeResult(
      await service.client.session.promptAsync({
        path: { id: sessionId },
        query: { directory: input.rootPath },
        body: {
          model,
          parts: [
            {
              type: "text",
              text: buildAgentSystemPrompt({
                projectName: input.projectName,
                activeEditorPath: input.activeEditorPath,
                activePdfPath: input.activePdfPath,
                selectedFiles: input.selectedFiles,
                compileSummary: input.compileSummary,
                prompt: input.prompt,
              }),
            },
          ],
        },
      }),
      "OpenCode prompt request",
    );

    return { runId };
  },

  async cancel(runId: string): Promise<void> {
    for (const service of serveServices.values()) {
      if (await cancelServeRunInService(service, runId)) return;
    }
  },

  clearSession(rootPath: string): void {
    const service = serveServices.get(rootPath);
    if (!service) return;
    serveServices.delete(rootPath);
    service.eventAbort?.abort();
    if (service.activeRun) {
      void service.abortSession(service.activeRun.sessionId).catch(() => {});
      finishServeRun(service, service.activeRun, null);
    }
    stopOpencodeServe(service.child);
  },
};
