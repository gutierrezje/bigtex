import type {
  AgentAvailability,
  AgentEvent,
  AgentRunInput,
  AgentRunSummary,
  AgentSessionConfig,
  CompileRequest,
  CompileResult,
  OpenFile,
  PatchApplyRequest,
  PatchApplyResult,
  PdfPayload,
  PerformanceMark,
  ProjectSnapshot,
  RecentProject,
} from "./domain";

export const IPC_CHANNELS = {
  appMetrics: "app:metrics",
  projectOpenDialog: "project:open-dialog",
  projectOpened: "project:opened",
  projectLoad: "project:load",
  projectLoadSample: "project:load-sample",
  fileRead: "file:read",
  fileWrite: "file:write",
  fileCreate: "file:create",
  fileRename: "file:rename",
  fileDelete: "file:delete",
  latexCompile: "latex:compile",
  pdfRead: "pdf:read",
  agentCheck: "agent:check",
  agentRun: "agent:run",
  agentCancel: "agent:cancel",
  agentConfig: "agent:config",
  agentProbeModel: "agent:probe-model",
  agentEvent: "agent:event",
  patchApply: "patch:apply",
  recentsGet: "recents:get",
  recentsRemove: "recents:remove",
  recentsClear: "recents:clear",
} as const;

export interface ReadFileRequest {
  rootPath: string;
  path: string;
}

export interface WriteFileRequest extends ReadFileRequest {
  content: string;
}

export interface CreateFileRequest {
  rootPath: string;
  parentPath: string;
  name: string;
}

export interface RenamePathRequest {
  rootPath: string;
  path: string;
  newName: string;
}

export interface DeletePathRequest {
  rootPath: string;
  path: string;
}

export interface AgentCheckRequest {
  command: string;
}

export interface AgentCancelRequest {
  runId: string;
}

export interface BigTexApi {
  app: {
    metrics(): Promise<PerformanceMark[]>;
  };
  project: {
    openDialog(): Promise<ProjectSnapshot | null>;
    /** Main process notifies when a folder is opened from the app menu (e.g. File → Open Folder). */
    onOpened(listener: (snapshot: ProjectSnapshot) => void): () => void;
    load(rootPath: string): Promise<ProjectSnapshot>;
    loadSample(): Promise<ProjectSnapshot>;
  };
  files: {
    read(request: ReadFileRequest): Promise<OpenFile>;
    write(request: WriteFileRequest): Promise<OpenFile>;
    create(request: CreateFileRequest): Promise<{ snapshot: ProjectSnapshot; createdPath: string }>;
    rename(request: RenamePathRequest): Promise<{ snapshot: ProjectSnapshot; newPath: string }>;
    delete(request: DeletePathRequest): Promise<ProjectSnapshot>;
  };
  latex: {
    compile(request: CompileRequest): Promise<CompileResult>;
    readPdf(path: string): Promise<PdfPayload>;
  };
  agent: {
    check(request: AgentCheckRequest): Promise<AgentAvailability>;
    loadConfig(rootPath: string): Promise<AgentSessionConfig>;
    probeModelVariants(rootPath: string, modelId: string): Promise<string[]>;
    run(request: AgentRunInput): Promise<AgentRunSummary>;
    cancel(request: AgentCancelRequest): Promise<void>;
    onEvent(listener: (event: AgentEvent) => void): () => void;
  };
  patch: {
    apply(request: PatchApplyRequest): Promise<PatchApplyResult>;
  };
  recents: {
    get(): Promise<RecentProject[]>;
    remove(path: string): Promise<RecentProject[]>;
    clear(): Promise<void>;
  };
}

declare global {
  interface Window {
    bigTex: BigTexApi;
  }
}
