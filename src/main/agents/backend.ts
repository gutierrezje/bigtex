import type {
  AgentAvailability,
  AgentEvent,
  AgentRunInput,
  AgentRunSummary,
  AgentSessionConfig,
} from "../../shared/domain";
import { serveAgentBackend } from "./opencode-serve";

export interface AgentBackend {
  id: "serve";
  check(commandLine?: string): Promise<AgentAvailability>;
  loadConfig(rootPath: string): Promise<AgentSessionConfig>;
  probeModelVariants(rootPath: string, modelId: string): Promise<string[]>;
  run(input: AgentRunInput, emit: (event: AgentEvent) => void): Promise<AgentRunSummary>;
  cancel(runId: string): Promise<void>;
  clearSession(rootPath: string): void | Promise<void>;
}

export function getAgentBackend(): AgentBackend {
  return serveAgentBackend;
}
