import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
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
import type { AgentBackend } from "./backend";
import { opencodeShellEnv, startOpencodeServe, stopOpencodeServe } from "./opencode-providers";

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
  baseUrl: string;
  child: Parameters<typeof stopOpencodeServe>[0];
  sessionId: string | null;
  eventAbort: AbortController | null;
  activeRun: ServeActiveRun | null;
}

interface ServeActiveRun {
  runId: string;
  sessionId: string;
  startedAt: number;
  emit: (event: AgentEvent) => void;
  textParts: Map<string, string>;
}

const serveServices = new Map<string, ServeService>();

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
    baseUrl: `http://127.0.0.1:${port}`,
    child,
    sessionId: null,
    eventAbort: null,
    activeRun: null,
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

function textDeltaForPart(run: ServeActiveRun, properties: Record<string, unknown>): string | null {
  const part = properties.part;
  if (!part || typeof part !== "object") return null;
  const record = part as Record<string, unknown>;
  if (record.type !== "text") return null;

  const delta = properties.delta;
  if (delta && typeof delta === "object") {
    const text = (delta as Record<string, unknown>).text;
    if (typeof text === "string") return text;
  }

  const text = record.text;
  if (typeof text !== "string") return null;

  const key =
    typeof record.id === "string"
      ? record.id
      : `${String(properties.messageID ?? properties.messageId ?? "message")}:text`;
  const previous = run.textParts.get(key) ?? "";
  run.textParts.set(key, text);
  return text.startsWith(previous) ? text.slice(previous.length) : text;
}

export function handleServeEvent(service: ServeService, event: Record<string, unknown>): void {
  const type = eventType(event);
  const run = service.activeRun;
  if (!type || !run) return;

  const sessionId = eventSessionId(event);
  if (sessionId && sessionId !== run.sessionId) return;

  const properties = eventProperties(event);
  if (type === "message.part.updated") {
    const chunk = textDeltaForPart(run, properties);
    if (chunk) {
      run.emit({ type: "message", runId: run.runId, chunk, at: Date.now() });
    }
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
    service.activeRun = { runId, sessionId, startedAt, emit, textParts: new Map() };
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
