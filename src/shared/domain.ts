export type FileKind = "tex" | "bib" | "style" | "config" | "pdf" | "folder" | "other";

export interface ProjectFile {
  name: string;
  path: string;
  absolutePath: string;
  kind: FileKind;
  children?: ProjectFile[];
}

export interface ProjectSnapshot {
  rootPath: string;
  name: string;
  files: ProjectFile[];
  mainFile: string | null;
}

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export interface OpenFile {
  path: string;
  absolutePath: string;
  content: string;
  dirty: boolean;
  /** Bumped on each disk read so the editor can reload external changes. */
  loadedAt: number;
}

export interface CompileDiagnostic {
  file: string | null;
  line: number | null;
  severity: "error" | "warning";
  message: string;
}

export interface CompileRequest {
  rootPath: string;
  mainFile: string;
}

export interface CompileResult {
  success: boolean;
  command: string;
  durationMs: number;
  output: string;
  pdfPath: string | null;
  diagnostics: CompileDiagnostic[];
}

export interface PdfPayload {
  path: string;
  data: Uint8Array;
  loadedAt: number;
}

export interface AgentAvailability {
  available: boolean;
  command: string;
  version: string | null;
  message: string;
}

export type AgentProviderGroup = "free" | "go" | "copilot";

export interface AgentModelOption {
  id: string;
  name: string;
  label: string;
  providerGroup: AgentProviderGroup;
  variant: string | null;
}

export interface AgentSessionConfig {
  models: AgentModelOption[];
  currentModelId: string;
  availableVariants: string[];
  currentVariant: string | null;
  /** Variants discovered per base model id (e.g. opencode-go/deepseek-v4-pro → xhigh, med, …). */
  variantsByModel: Record<string, string[]>;
}

export interface AgentRunInput {
  rootPath: string;
  prompt: string;
  selectedFiles: string[];
  compileSummary: string | null;
  modelId: string;
  reasoningLevel: string | null;
}

export type AgentEvent =
  | {
      type: "started";
      runId: string;
      command: string;
      at: number;
    }
  | {
      type: "thought";
      runId: string;
      chunk: string;
      at: number;
    }
  | {
      type: "message";
      runId: string;
      chunk: string;
      at: number;
    }
  | {
      type: "activity";
      runId: string;
      chunk: string;
      at: number;
    }
  | {
      type: "stderr";
      runId: string;
      chunk: string;
      at: number;
    }
  | {
      type: "patch";
      runId: string;
      patch: string;
      at: number;
    }
  | {
      type: "filesChanged";
      runId: string;
      paths: string[];
      at: number;
    }
  | {
      type: "finished";
      runId: string;
      exitCode: number | null;
      durationMs: number;
      at: number;
    }
  | {
      type: "error";
      runId: string;
      message: string;
      at: number;
    };

export interface AgentRunSummary {
  runId: string;
}

export interface PatchApplyRequest {
  rootPath: string;
  patch: string;
}

export interface PatchApplyResult {
  applied: boolean;
  changedFiles: string[];
  message: string;
}

export interface PerformanceMark {
  name: string;
  durationMs: number;
  at: number;
}
