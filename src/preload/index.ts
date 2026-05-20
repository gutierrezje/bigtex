import { contextBridge, ipcRenderer } from "electron";
import type { AgentEvent, ProjectSnapshot } from "../shared/domain";
import { type BigTexApi, IPC_CHANNELS } from "../shared/ipc";

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
    load: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.projectLoad, rootPath),
  },
  files: {
    read: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileRead, request),
    write: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileWrite, request),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileCreate, request),
    rename: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileRename, request),
    delete: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileDelete, request),
  },
  latex: {
    compile: (request) => ipcRenderer.invoke(IPC_CHANNELS.latexCompile, request),
    readPdf: (path) => ipcRenderer.invoke(IPC_CHANNELS.pdfRead, path),
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
};

contextBridge.exposeInMainWorld("bigTex", api);
