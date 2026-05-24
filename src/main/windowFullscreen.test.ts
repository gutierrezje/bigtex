import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isWindowFullscreen,
  setWindowFullscreen,
  toggleWindowFullscreen,
} from "./windowFullscreen";

function mockWindow(overrides: { isFullScreen?: boolean } = {}) {
  return {
    isFullScreen: vi.fn(() => overrides.isFullScreen ?? false),
    setFullScreen: vi.fn(),
    isDestroyed: () => false,
  } as unknown as import("electron").BrowserWindow;
}

describe("windowFullscreen", () => {
  it("reads fullscreen state from the window", () => {
    const win = mockWindow({ isFullScreen: true });
    expect(isWindowFullscreen(win)).toBe(true);
  });

  it("enters and exits native fullscreen", () => {
    const win = mockWindow({ isFullScreen: true });
    setWindowFullscreen(win, false);
    expect(win.setFullScreen).toHaveBeenCalledWith(false);
  });

  it("toggles fullscreen", () => {
    const win = mockWindow({ isFullScreen: false });
    toggleWindowFullscreen(win);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
  });
});
