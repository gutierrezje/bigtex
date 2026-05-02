import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { AgentRunInput, CompileRequest, PatchApplyRequest } from "../shared/domain";
import {
  type AgentCheckRequest,
  IPC_CHANNELS,
  type ReadFileRequest,
  type WriteFileRequest,
} from "../shared/ipc";
import { cancelOpencode, checkOpencode, runOpencode } from "./agents/opencode";
import { applyUnifiedPatch } from "./agents/patch";
import { compileLatex } from "./compile/latex";
import {
  defaultSampleProjectPath,
  loadProject,
  readProjectFile,
  writeProjectFile,
} from "./files/project";
import { getMarks, measure, recordMark } from "./performance/marks";

const appStartedAt = performance.now();
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const windowStartedAt = performance.now();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: "BigTex",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    recordMark("window:ready-to-show", performance.now() - windowStartedAt);
    recordMark("app:cold-start", performance.now() - appStartedAt);
    mainWindow?.show();
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
    },
  );

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`[renderer:gone] ${details.reason} exitCode=${details.exitCode}`);
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.appMetrics, () => getMarks());

  ipcMain.handle(IPC_CHANNELS.projectOpenDialog, async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Open LaTeX Project",
    });

    if (result.canceled || !result.filePaths[0]) return null;
    return measure("project:load", () => loadProject(result.filePaths[0]));
  });

  ipcMain.handle(IPC_CHANNELS.projectOpenSample, () =>
    measure("project:sample", () => loadProject(defaultSampleProjectPath(app.getAppPath()))),
  );

  ipcMain.handle(IPC_CHANNELS.projectLoad, (_event, rootPath: string) =>
    measure("project:load", () => loadProject(rootPath)),
  );

  ipcMain.handle(IPC_CHANNELS.fileRead, (_event, request: ReadFileRequest) =>
    measure("file:read", () => readProjectFile(request.rootPath, request.path)),
  );

  ipcMain.handle(IPC_CHANNELS.fileWrite, (_event, request: WriteFileRequest) =>
    measure("file:write", () => writeProjectFile(request.rootPath, request.path, request.content)),
  );

  ipcMain.handle(IPC_CHANNELS.latexCompile, (_event, request: CompileRequest) =>
    compileLatex(request),
  );

  ipcMain.handle(IPC_CHANNELS.pdfRead, async (_event, path: string) => {
    const data = await measure("pdf:read", () => readFile(path));
    return {
      path,
      data: new Uint8Array(data),
      loadedAt: Date.now(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.agentCheck, (_event, request: AgentCheckRequest) =>
    checkOpencode(request.command),
  );

  ipcMain.handle(IPC_CHANNELS.agentRun, (_event, request: AgentRunInput) =>
    runOpencode(request, (agentEvent) => {
      mainWindow?.webContents.send(IPC_CHANNELS.agentEvent, agentEvent);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.agentCancel, (_event, request: { runId: string }) =>
    cancelOpencode(request.runId),
  );

  ipcMain.handle(IPC_CHANNELS.patchApply, (_event, request: PatchApplyRequest) =>
    applyUnifiedPatch(request),
  );
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
