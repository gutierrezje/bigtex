import type { BrowserWindow } from "electron";

export function isWindowFullscreen(window: BrowserWindow): boolean {
  return window.isFullScreen();
}

export function setWindowFullscreen(window: BrowserWindow, fullscreen: boolean): void {
  window.setFullScreen(fullscreen);
}

export function toggleWindowFullscreen(window: BrowserWindow): void {
  setWindowFullscreen(window, !isWindowFullscreen(window));
}
