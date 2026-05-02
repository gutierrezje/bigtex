import type {
  AgentAvailability,
  AgentEvent,
  AgentRunInput,
  AgentRunSummary,
  CompileRequest,
  CompileResult,
  OpenFile,
  PatchApplyRequest,
  PatchApplyResult,
  PdfPayload,
  PerformanceMark,
  ProjectSnapshot,
} from "./domain";

export const IPC_CHANNELS = {
  appMetrics: "app:metrics",
  projectOpenDialog: "project:open-dialog",
  projectOpenSample: "project:open-sample",
  projectLoad: "project:load",
  fileRead: "file:read",
  fileWrite: "file:write",
  latexCompile: "latex:compile",
  pdfRead: "pdf:read",
  agentCheck: "agent:check",
  agentRun: "agent:run",
  agentCancel: "agent:cancel",
  agentEvent: "agent:event",
  patchApply: "patch:apply",
} as const;

export interface ReadFileRequest {
  rootPath: string;
  path: string;
}

export interface WriteFileRequest extends ReadFileRequest {
  content: string;
}

export interface AgentCheckRequest {
  command: string;
}

export interface AgentCancelRequest {
  runId: string;
}

export interface TexRangerApi {
  app: {
    metrics(): Promise<PerformanceMark[]>;
  };
  project: {
    openDialog(): Promise<ProjectSnapshot | null>;
    openSample(): Promise<ProjectSnapshot>;
    load(rootPath: string): Promise<ProjectSnapshot>;
  };
  files: {
    read(request: ReadFileRequest): Promise<OpenFile>;
    write(request: WriteFileRequest): Promise<OpenFile>;
  };
  latex: {
    compile(request: CompileRequest): Promise<CompileResult>;
    readPdf(path: string): Promise<PdfPayload>;
  };
  agent: {
    check(request: AgentCheckRequest): Promise<AgentAvailability>;
    run(request: AgentRunInput): Promise<AgentRunSummary>;
    cancel(request: AgentCancelRequest): Promise<void>;
    onEvent(listener: (event: AgentEvent) => void): () => void;
  };
  patch: {
    apply(request: PatchApplyRequest): Promise<PatchApplyResult>;
  };
}

declare global {
  interface Window {
    texRanger: TexRangerApi;
  }
}
