import { app, BrowserWindow, dialog, Menu } from "electron";
import type { ProjectSnapshot } from "../shared/domain";
import { IPC_CHANNELS } from "../shared/ipc";
import { isNewProjectDirectoryEmpty, loadProject, scaffoldBlankProject } from "./files/project";
import { addRecent } from "./files/recents";
import { measure } from "./performance/marks";
import { toggleWindowFullscreen } from "./windowFullscreen";

export async function openProjectFolderDialog(
  parentWindow: BrowserWindow | null,
): Promise<ProjectSnapshot | null> {
  const options = {
    properties: ["openDirectory" as const],
    title: "Open Folder",
    buttonLabel: "Open",
  };

  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) return null;
  return measure("project:load", () => loadProject(result.filePaths[0]));
}

export async function createProjectFolderDialog(
  parentWindow: BrowserWindow | null,
): Promise<ProjectSnapshot | null> {
  const options = {
    properties: ["openDirectory" as const, "createDirectory" as const],
    title: "New Project",
    buttonLabel: "Create",
    message: "Choose a folder for your new LaTeX project",
  };

  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) return null;

  const rootPath = result.filePaths[0];
  const empty = await isNewProjectDirectoryEmpty(rootPath);
  if (!empty) {
    const { response } = parentWindow
      ? await dialog.showMessageBox(parentWindow, {
          type: "warning",
          buttons: ["Cancel", "Use This Folder"],
          defaultId: 1,
          cancelId: 0,
          title: "Folder Not Empty",
          message: "This folder already contains files.",
          detail:
            "BigTeX will add main.tex and references.bib only if they are missing. Other files will be left as-is. Continue?",
        })
      : await dialog.showMessageBox({
          type: "warning",
          buttons: ["Cancel", "Use This Folder"],
          defaultId: 1,
          cancelId: 0,
          title: "Folder Not Empty",
          message: "This folder already contains files.",
          detail:
            "BigTeX will add main.tex and references.bib only if they are missing. Other files will be left as-is. Continue?",
        });
    if (response !== 1) return null;
  }

  return measure("project:create", () => scaffoldBlankProject(rootPath));
}

export function setApplicationMenu(getTargetWindow: () => BrowserWindow | null): void {
  const notifyProjectOpened = async (snapshot: ProjectSnapshot | null): Promise<void> => {
    const win = BrowserWindow.getFocusedWindow() ?? getTargetWindow();
    if (snapshot && win && !win.isDestroyed()) {
      await addRecent(snapshot.rootPath);
      win.webContents.send(IPC_CHANNELS.projectOpened, snapshot);
    }
  };

  const onOpenFolder = async (): Promise<void> => {
    const win = BrowserWindow.getFocusedWindow() ?? getTargetWindow();
    await notifyProjectOpened(await openProjectFolderDialog(win));
  };

  const onNewProject = async (): Promise<void> => {
    const win = BrowserWindow.getFocusedWindow() ?? getTargetWindow();
    await notifyProjectOpened(await createProjectFolderDialog(win));
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } satisfies Electron.MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Project…",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => void onNewProject(),
        },
        {
          label: "Open Folder…",
          accelerator: "CmdOrCtrl+O",
          click: () => void onOpenFolder(),
        },
        {
          label: "Close Folder",
          accelerator: "CmdOrCtrl+Shift+W",
          click: () => {
            const win = BrowserWindow.getFocusedWindow() ?? getTargetWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send(IPC_CHANNELS.projectClosed);
            }
          },
        },
        ...(process.platform === "darwin"
          ? []
          : ([
              { type: "separator" },
              { role: "quit" },
            ] satisfies Electron.MenuItemConstructorOptions[])),
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(process.platform === "darwin"
          ? ([
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
            ] satisfies Electron.MenuItemConstructorOptions[])
          : ([{ role: "selectAll" }] satisfies Electron.MenuItemConstructorOptions[])),
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        {
          label: "Toggle Full Screen",
          accelerator: process.platform === "darwin" ? "Ctrl+Command+F" : "F11",
          click: () => {
            const win = BrowserWindow.getFocusedWindow() ?? getTargetWindow();
            if (win && !win.isDestroyed()) toggleWindowFullscreen(win);
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(process.platform === "darwin"
          ? ([
              { type: "separator" },
              { role: "front" },
            ] satisfies Electron.MenuItemConstructorOptions[])
          : []),
        { role: "close" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
