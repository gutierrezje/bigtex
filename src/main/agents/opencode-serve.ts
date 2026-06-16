import type {
  AgentAvailability,
  AgentEvent,
  AgentRunInput,
  AgentRunSummary,
  AgentSessionConfig,
} from "../../shared/domain";
import type { AgentBackend } from "./backend";

function notImplemented(): Error {
  return new Error("OpenCode serve backend is not implemented yet");
}

export const serveAgentBackend: AgentBackend & { id: "serve" } = {
  id: "serve",

  async check(commandLine = "opencode"): Promise<AgentAvailability> {
    return {
      available: false,
      command: commandLine,
      version: null,
      message: notImplemented().message,
    };
  },

  async loadConfig(_rootPath: string): Promise<AgentSessionConfig> {
    throw notImplemented();
  },

  async probeModelVariants(_rootPath: string, _modelId: string): Promise<string[]> {
    throw notImplemented();
  },

  async run(_input: AgentRunInput, _emit: (event: AgentEvent) => void): Promise<AgentRunSummary> {
    throw notImplemented();
  },

  async cancel(_runId: string): Promise<void> {
    throw notImplemented();
  },

  clearSession(_rootPath: string): void {
    // No persistent serve process exists until the backend is implemented.
  },
};
