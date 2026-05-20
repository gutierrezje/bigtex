import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import type { AgentRunInput, CompileRequest, PatchApplyRequest } from "../shared/domain";
import {
  type AgentCheckRequest,
  type CreateFileRequest,
  type DeletePathRequest,
  IPC_CHANNELS,
  type ReadFileRequest,
  type RenamePathRequest,
  type WriteFileRequest,
} from "../shared/ipc";
import {
  cancelOpencode,
  checkOpencode,
  loadOpencodeSessionConfig,
  probeOpencodeModelVariants,
  runOpencode,
} from "./agents/opencode";
import { applyUnifiedPatch } from "./agents/patch";
import { compileLatex } from "./compile/latex";
import {
  createProjectFile,
  deleteProjectPath,
  loadProject,
  readProjectFile,
  renameProjectPath,
  writeProjectFile,
} from "./files/project";
import { openProjectFolderDialog, setApplicationMenu } from "./menu";
import { getMarks, measure, recordMark } from "./performance/marks";

const appStartedAt = performance.now();
let mainWindow: BrowserWindow | null = null;

app.setName("BigTeX");

function createWindow(): void {
  const windowStartedAt = performance.now();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: "BigTeX",
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

  ipcMain.handle(IPC_CHANNELS.projectOpenDialog, async () =>
    openProjectFolderDialog(BrowserWindow.getFocusedWindow() ?? mainWindow),
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

  ipcMain.handle(IPC_CHANNELS.fileCreate, (_event, request: CreateFileRequest) =>
    measure("file:create", () =>
      createProjectFile(request.rootPath, request.parentPath, request.name),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.fileRename, (_event, request: RenamePathRequest) =>
    measure("file:rename", () =>
      renameProjectPath(request.rootPath, request.path, request.newName),
    ),
  );

  ipcMain.handle(IPC_CHANNELS.fileDelete, (_event, request: DeletePathRequest) =>
    measure("file:delete", () => deleteProjectPath(request.rootPath, request.path)),
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

  ipcMain.handle(IPC_CHANNELS.agentConfig, (_event, rootPath: string) =>
    loadOpencodeSessionConfig(rootPath),
  );

  ipcMain.handle(IPC_CHANNELS.agentProbeModel, (_event, rootPath: string, modelId: string) =>
    probeOpencodeModelVariants(rootPath, modelId),
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
  setApplicationMenu(() => mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
