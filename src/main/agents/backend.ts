import type {
  AgentAvailability,
  AgentEvent,
  AgentRunInput,
  AgentRunSummary,
  AgentSessionConfig,
} from "../../shared/domain";
import { acpAgentBackend } from "./opencode";
import { serveAgentBackend } from "./opencode-serve";

export interface AgentBackend {
  id: AgentBackendId;
  check(commandLine?: string): Promise<AgentAvailability>;
  loadConfig(rootPath: string): Promise<AgentSessionConfig>;
  probeModelVariants(rootPath: string, modelId: string): Promise<string[]>;
  run(input: AgentRunInput, emit: (event: AgentEvent) => void): Promise<AgentRunSummary>;
  cancel(runId: string): Promise<void>;
  clearSession(rootPath: string): void | Promise<void>;
}

export type AgentBackendId = "acp" | "serve";

export function resolveAgentBackendId(value = process.env.BIGTEX_AGENT_BACKEND): AgentBackendId {
  return value === "serve" ? "serve" : "acp";
}

export function getAgentBackend(value = process.env.BIGTEX_AGENT_BACKEND): AgentBackend {
  return resolveAgentBackendId(value) === "serve" ? serveAgentBackend : acpAgentBackend;
}
