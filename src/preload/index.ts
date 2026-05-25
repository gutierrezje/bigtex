import { contextBridge, ipcRenderer } from "electron";
import type { AgentEvent, ProjectSnapshot } from "../shared/domain";
import { type BigTexApi, IPC_CHANNELS } from "../shared/ipc";
import type { LspServerMessageEvent } from "../shared/lsp";

const api: BigTexApi = {
  app: {
    metrics: () => ipcRenderer.invoke(IPC_CHANNELS.appMetrics),
  },
  project: {
    openDialog: () => ipcRenderer.invoke(IPC_CHANNELS.projectOpenDialog),
    onOpened: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: ProjectSnapshot) => {
        listener(snapshot);
      };
      ipcRenderer.on(IPC_CHANNELS.projectOpened, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.projectOpened, handler);
    },
    onClosed: (listener) => {
      const handler = () => {
        listener();
      };
      ipcRenderer.on(IPC_CHANNELS.projectClosed, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.projectClosed, handler);
    },
    load: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.projectLoad, rootPath),
    openPath: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.projectOpenPath, rootPath),
    createDialog: () => ipcRenderer.invoke(IPC_CHANNELS.projectCreateDialog),
  },
  files: {
    read: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileRead, request),
    write: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileWrite, request),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileCreate, request),
    createFolder: (request) => ipcRenderer.invoke(IPC_CHANNELS.folderCreate, request),
    rename: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileRename, request),
    delete: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileDelete, request),
  },
  latex: {
    compile: (request) => ipcRenderer.invoke(IPC_CHANNELS.latexCompile, request),
    readPdf: (path) => ipcRenderer.invoke(IPC_CHANNELS.pdfRead, path),
  },
  lsp: {
    check: (request) => ipcRenderer.invoke(IPC_CHANNELS.lspCheck, request ?? {}),
    startSession: (request) => ipcRenderer.invoke(IPC_CHANNELS.lspSessionStart, request),
    stopSession: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.lspSessionStop, rootPath),
    sessionStatus: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.lspSessionStatus, rootPath),
    send: (request) => ipcRenderer.invoke(IPC_CHANNELS.lspSend, request),
    onMessage: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: LspServerMessageEvent) => {
        listener(payload);
      };
      ipcRenderer.on(IPC_CHANNELS.lspMessage, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.lspMessage, handler);
    },
  },
  agent: {
    check: (request) => ipcRenderer.invoke(IPC_CHANNELS.agentCheck, request),
    loadConfig: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.agentConfig, rootPath),
    probeModelVariants: (rootPath, modelId) =>
      ipcRenderer.invoke(IPC_CHANNELS.agentProbeModel, rootPath, modelId),
    run: (request) => ipcRenderer.invoke(IPC_CHANNELS.agentRun, request),
    cancel: (request) => ipcRenderer.invoke(IPC_CHANNELS.agentCancel, request),
    onEvent: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, agentEvent: AgentEvent) => {
        listener(agentEvent);
      };
      ipcRenderer.on(IPC_CHANNELS.agentEvent, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.agentEvent, handler);
    },
  },
  patch: {
    apply: (request) => ipcRenderer.invoke(IPC_CHANNELS.patchApply, request),
  },
  recents: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.recentsGet),
    remove: (path) => ipcRenderer.invoke(IPC_CHANNELS.recentsRemove, path),
    clear: () => ipcRenderer.invoke(IPC_CHANNELS.recentsClear),
  },
  window: {
    close: () => ipcRenderer.invoke(IPC_CHANNELS.windowClose),
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMinimize),
    toggleFullscreen: () => ipcRenderer.invoke(IPC_CHANNELS.windowToggleFullscreen),
    isFullscreen: () => ipcRenderer.invoke(IPC_CHANNELS.windowIsFullscreen),
    usesCustomWindowControls: process.platform === "darwin",
    onFullscreenChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, isFullscreen: boolean) => {
        listener(isFullscreen);
      };
      ipcRenderer.on(IPC_CHANNELS.windowFullscreenChanged, handler);
      return () => ipcRenderer.off(IPC_CHANNELS.windowFullscreenChanged, handler);
    },
  },
};

contextBridge.exposeInMainWorld("bigTex", api);
