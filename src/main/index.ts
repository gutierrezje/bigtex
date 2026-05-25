import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import type { AgentRunInput, CompileRequest, PatchApplyRequest } from "../shared/domain";
import {
  type AgentCheckRequest,
  type CreateFileRequest,
  type CreateFolderRequest,
  type DeletePathRequest,
  IPC_CHANNELS,
  type LanguageServerCheckRequest,
  type LanguageServerStartSessionRequest,
  type ReadFileRequest,
  type RenamePathRequest,
  type WriteFileRequest,
} from "../shared/ipc";
import type { LspSendRequest } from "../shared/lsp";
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
  createProjectFolder,
  deleteProjectPath,
  loadProject,
  readProjectFile,
  renameProjectPath,
  writeProjectFile,
} from "./files/project";
import { addRecent, clearRecents, getRecents, removeRecent } from "./files/recents";
import {
  checkTexlab,
  getTexlabSessionStatus,
  sendLspMessage,
  setLspServerMessageHandler,
  startTexlabSession,
  stopAllTexlabSessions,
  stopTexlabSession,
} from "./lsp/texlab";
import { createProjectFolderDialog, openProjectFolderDialog, setApplicationMenu } from "./menu";
import { getMarks, measure, recordMark } from "./performance/marks";
import { isWindowFullscreen, toggleWindowFullscreen } from "./windowFullscreen";

const appStartedAt = performance.now();
let mainWindow: BrowserWindow | null = null;

if (process.env.BIGTEX_PERF_CDP === "1") {
  const port = process.env.BIGTEX_PERF_CDP_PORT ?? "9333";
  app.commandLine.appendSwitch("remote-debugging-port", port);
}

app.setName("BigTeX");

function createWindow(): void {
  const windowStartedAt = performance.now();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: "BigTeX",
    titleBarStyle: "hidden",
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
    if (process.platform === "darwin") {
      // Hide native traffic lights once; toggling them during fullscreen crashes AppKit.
      mainWindow?.setWindowButtonVisibility(false);
    }
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

  attachFullscreenChrome(mainWindow);
}

function focusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? mainWindow;
}

function notifyFullscreenChanged(isFullscreen: boolean): void {
  mainWindow?.webContents.send(IPC_CHANNELS.windowFullscreenChanged, isFullscreen);
}

function attachFullscreenChrome(window: BrowserWindow): void {
  window.on("enter-full-screen", () => notifyFullscreenChanged(true));
  window.on("leave-full-screen", () => notifyFullscreenChanged(false));
}

function registerIpc(): void {
  setLspServerMessageHandler((event) => {
    mainWindow?.webContents.send(IPC_CHANNELS.lspMessage, event);
  });

  ipcMain.handle(IPC_CHANNELS.appMetrics, () => getMarks());

  ipcMain.handle(IPC_CHANNELS.projectOpenDialog, async () => {
    const snapshot = await openProjectFolderDialog(BrowserWindow.getFocusedWindow() ?? mainWindow);
    if (snapshot) {
      await addRecent(snapshot.rootPath);
    }
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.projectLoad, async (_event, rootPath: string) => {
    const snapshot = await measure("project:load", () => loadProject(rootPath));
    if (snapshot) {
      await addRecent(rootPath);
    }
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.projectOpenPath, async (_event, rootPath: string) => {
    const snapshot = await measure("project:load", () => loadProject(rootPath));
    if (snapshot) {
      await addRecent(rootPath);
      mainWindow?.webContents.send(IPC_CHANNELS.projectOpened, snapshot);
    }
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.projectCreateDialog, async () => {
    const snapshot = await createProjectFolderDialog(
      BrowserWindow.getFocusedWindow() ?? mainWindow,
    );
    if (snapshot) {
      await addRecent(snapshot.rootPath);
    }
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.recentsGet, () => getRecents());
  ipcMain.handle(IPC_CHANNELS.recentsRemove, (_event, path: string) => removeRecent(path));
  ipcMain.handle(IPC_CHANNELS.recentsClear, () => clearRecents());

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

  ipcMain.handle(IPC_CHANNELS.folderCreate, (_event, request: CreateFolderRequest) =>
    measure("folder:create", () =>
      createProjectFolder(request.rootPath, request.parentPath, request.name),
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

  ipcMain.handle(IPC_CHANNELS.lspCheck, (_event, request: LanguageServerCheckRequest) =>
    checkTexlab(request.command),
  );

  ipcMain.handle(
    IPC_CHANNELS.lspSessionStart,
    (_event, request: LanguageServerStartSessionRequest) =>
      measure("lsp:session-start", () => startTexlabSession(request.rootPath, request.mainFile)),
  );

  ipcMain.handle(IPC_CHANNELS.lspSessionStop, (_event, rootPath: string) =>
    measure("lsp:session-stop", () => stopTexlabSession(rootPath)),
  );

  ipcMain.handle(IPC_CHANNELS.lspSessionStatus, (_event, rootPath: string) =>
    getTexlabSessionStatus(rootPath),
  );

  ipcMain.handle(IPC_CHANNELS.lspSend, (_event, request: LspSendRequest) => {
    sendLspMessage(request.rootPath, request.message);
  });

  ipcMain.handle(IPC_CHANNELS.windowClose, () => {
    focusedWindow()?.close();
  });

  ipcMain.handle(IPC_CHANNELS.windowMinimize, () => {
    focusedWindow()?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.windowToggleFullscreen, () => {
    const window = focusedWindow();
    if (!window || window.isDestroyed()) return;
    toggleWindowFullscreen(window);
  });

  ipcMain.handle(IPC_CHANNELS.windowIsFullscreen, () => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    return isWindowFullscreen(mainWindow);
  });
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

app.on("before-quit", () => {
  void stopAllTexlabSessions();
});
