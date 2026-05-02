import { contextBridge, ipcRenderer } from "electron";
import type { AgentEvent } from "../shared/domain";
import { type BigTexApi, IPC_CHANNELS } from "../shared/ipc";

const api: BigTexApi = {
  app: {
    metrics: () => ipcRenderer.invoke(IPC_CHANNELS.appMetrics),
  },
  project: {
    openDialog: () => ipcRenderer.invoke(IPC_CHANNELS.projectOpenDialog),
    openSample: () => ipcRenderer.invoke(IPC_CHANNELS.projectOpenSample),
    load: (rootPath) => ipcRenderer.invoke(IPC_CHANNELS.projectLoad, rootPath),
  },
  files: {
    read: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileRead, request),
    write: (request) => ipcRenderer.invoke(IPC_CHANNELS.fileWrite, request),
  },
  latex: {
    compile: (request) => ipcRenderer.invoke(IPC_CHANNELS.latexCompile, request),
    readPdf: (path) => ipcRenderer.invoke(IPC_CHANNELS.pdfRead, path),
  },
  agent: {
    check: (request) => ipcRenderer.invoke(IPC_CHANNELS.agentCheck, request),
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
