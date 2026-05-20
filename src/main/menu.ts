import { app, BrowserWindow, dialog, Menu } from "electron";
import type { ProjectSnapshot } from "../shared/domain";
import { IPC_CHANNELS } from "../shared/ipc";
import { loadProject } from "./files/project";
import { addRecent } from "./files/recents";
import { measure } from "./performance/marks";

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

export function setApplicationMenu(getTargetWindow: () => BrowserWindow | null): void {
  const onOpenFolder = async (): Promise<void> => {
    const win = BrowserWindow.getFocusedWindow() ?? getTargetWindow();
    const snapshot = await openProjectFolderDialog(win);
    if (snapshot && win && !win.isDestroyed()) {
      await addRecent(snapshot.rootPath);
      win.webContents.send(IPC_CHANNELS.projectOpened, snapshot);
    }
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
        { role: "togglefullscreen" },
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
