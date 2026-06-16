import { spawn } from "node:child_process";
import {
  filterAgentModels,
  providerGroupFromModelId,
  sortReasoningVariants,
} from "../../shared/agent-models";
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

interface ServeService {
  baseUrl: string;
  child: Parameters<typeof stopOpencodeServe>[0];
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
  const service = { baseUrl: `http://127.0.0.1:${port}`, child };
  serveServices.set(rootPath, service);
  child.on("exit", () => {
    const current = serveServices.get(rootPath);
    if (current?.child === child) serveServices.delete(rootPath);
  });
  return service;
}

async function fetchServeProviders(rootPath: string): Promise<ServeProvidersResponse> {
  const service = await ensureServeService(rootPath);
  const url = `${service.baseUrl}/config/providers?directory=${encodeURIComponent(rootPath)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenCode providers request failed (${response.status})`);
  }
  return (await response.json()) as ServeProvidersResponse;
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

  async run(_input: AgentRunInput, _emit: (event: AgentEvent) => void): Promise<AgentRunSummary> {
    throw notImplemented();
  },

  async cancel(_runId: string): Promise<void> {
    throw notImplemented();
  },

  clearSession(rootPath: string): void {
    const service = serveServices.get(rootPath);
    if (!service) return;
    serveServices.delete(rootPath);
    stopOpencodeServe(service.child);
  },
};
