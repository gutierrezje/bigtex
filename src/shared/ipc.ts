import type {
  AgentAvailability,
  AgentEvent,
  AgentRunInput,
  AgentRunSummary,
  AgentSessionConfig,
  CompileRequest,
  CompileResult,
  LanguageServerAvailability,
  LanguageServerSessionStatus,
  LanguageServerStartSessionRequest,
  OpenFile,
  PatchApplyRequest,
  PatchApplyResult,
  PdfPayload,
  PerformanceMark,
  ProjectSnapshot,
  RecentProject,
} from "./domain";
import type { LspSendRequest, LspServerMessageEvent } from "./lsp";
import type {
  AgentPermissionRequestPayload,
  EffectiveSettings,
  SettingsFile,
  UserSettings,
  WorkspaceSettings,
} from "./settings";

export const IPC_CHANNELS = {
  appMetrics: "app:metrics",
  projectOpenDialog: "project:open-dialog",
  projectOpened: "project:opened",
  projectClosed: "project:closed",
  projectLoad: "project:load",
  projectOpenPath: "project:open-path",
  projectCreateDialog: "project:create-dialog",
  fileRead: "file:read",
  fileWrite: "file:write",
  fileCreate: "file:create",
  folderCreate: "folder:create",
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
  lspCheck: "lsp:check",
  lspSessionStart: "lsp:session-start",
  lspSessionStop: "lsp:session-stop",
  lspSessionStatus: "lsp:session-status",
  lspSend: "lsp:send",
  lspMessage: "lsp:message",
  recentsGet: "recents:get",
  recentsRemove: "recents:remove",
  recentsClear: "recents:clear",
  settingsLoad: "settings:load",
  settingsGetEffective: "settings:get-effective",
  settingsUpdateUser: "settings:update-user",
  settingsUpdateWorkspace: "settings:update-workspace",
  settingsPermissionRequest: "settings:permission-request",
  settingsPermissionRespond: "settings:permission-respond",
  settingsOpen: "settings:open",
  windowClose: "window:close",
  windowMinimize: "window:minimize",
  windowToggleFullscreen: "window:toggle-fullscreen",
  windowIsFullscreen: "window:is-fullscreen",
  windowFullscreenChanged: "window:fullscreen-changed",
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

export type CreateFolderRequest = CreateFileRequest;

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

export interface LanguageServerCheckRequest {
  command?: string;
}

export type { LanguageServerStartSessionRequest } from "./domain";

export interface AgentCancelRequest {
  runId: string;
}

export interface SettingsLoadRequest {
  legacyPdfPreviewInvert?: boolean;
}

export interface SettingsLoadResult {
  file: SettingsFile;
  effective: EffectiveSettings;
}

export interface SettingsUpdateWorkspaceRequest {
  rootPath: string;
  patch: Partial<WorkspaceSettings>;
}

export interface SettingsPermissionRespondRequest {
  requestId: string;
  optionId: string | null;
}

export interface BigTexApi {
  app: {
    metrics(): Promise<PerformanceMark[]>;
  };
  project: {
    openDialog(): Promise<ProjectSnapshot | null>;
    /** Main process notifies when a folder is opened from the app menu (e.g. File → Open Folder). */
    onOpened(listener: (snapshot: ProjectSnapshot) => void): () => void;
    /** Main process notifies when a folder is closed from the app menu (e.g. File → Close Folder). */
    onClosed(listener: () => void): () => void;
    load(rootPath: string): Promise<ProjectSnapshot>;
    /** Load a folder and notify the renderer (same as File → Open Folder). */
    openPath(rootPath: string): Promise<ProjectSnapshot>;
    createDialog(): Promise<ProjectSnapshot | null>;
  };
  files: {
    read(request: ReadFileRequest): Promise<OpenFile>;
    write(request: WriteFileRequest): Promise<OpenFile>;
    create(request: CreateFileRequest): Promise<{ snapshot: ProjectSnapshot; createdPath: string }>;
    createFolder(
      request: CreateFolderRequest,
    ): Promise<{ snapshot: ProjectSnapshot; createdPath: string }>;
    rename(request: RenamePathRequest): Promise<{ snapshot: ProjectSnapshot; newPath: string }>;
    delete(request: DeletePathRequest): Promise<ProjectSnapshot>;
  };
  latex: {
    compile(request: CompileRequest): Promise<CompileResult>;
    readPdf(path: string): Promise<PdfPayload>;
  };
  lsp: {
    check(request?: LanguageServerCheckRequest): Promise<LanguageServerAvailability>;
    startSession(request: LanguageServerStartSessionRequest): Promise<LanguageServerSessionStatus>;
    stopSession(rootPath: string): Promise<void>;
    sessionStatus(rootPath: string): Promise<LanguageServerSessionStatus | null>;
    send(request: LspSendRequest): Promise<void>;
    onMessage(listener: (event: LspServerMessageEvent) => void): () => void;
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
  settings: {
    load(request?: SettingsLoadRequest): Promise<SettingsLoadResult>;
    getEffective(rootPath?: string | null): Promise<EffectiveSettings>;
    updateUser(patch: Partial<UserSettings>): Promise<EffectiveSettings>;
    updateWorkspace(request: SettingsUpdateWorkspaceRequest): Promise<EffectiveSettings>;
    onPermissionRequest(listener: (payload: AgentPermissionRequestPayload) => void): () => void;
    respondPermission(request: SettingsPermissionRespondRequest): Promise<boolean>;
    onOpen(listener: () => void): () => void;
  };
  window: {
    close(): Promise<void>;
    minimize(): Promise<void>;
    toggleFullscreen(): Promise<void>;
    isFullscreen(): Promise<boolean>;
    /** macOS uses custom HTML traffic lights; native ones are hidden at startup. */
    usesCustomWindowControls: boolean;
    onFullscreenChanged(listener: (isFullscreen: boolean) => void): () => void;
  };
}

declare global {
  interface Window {
    bigTex: BigTexApi;
  }
}
