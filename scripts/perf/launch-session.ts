import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { _electron as electronLauncher, chromium, type Browser, type Page } from "playwright";

const require = createRequire(import.meta.url);
const electronExecutable = require("electron") as string;
const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const mainEntry = join(repoRoot, "out/main/index.js");
const cdpPort = process.env.BIGTEX_PERF_CDP_PORT ?? "9333";

export interface PerfSession {
  page: Page;
  browser?: Browser;
  electronApp?: Awaited<ReturnType<typeof electronLauncher.launch>>;
  devProcess?: ChildProcess;
  close(): Promise<void>;
}

async function waitForCdpEndpoint(preferredPort: string, timeoutMs = 120_000): Promise<string> {
  const ports = [preferredPort, "9222", "9229", "9333"];
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const port of ports) {
      const url = `http://127.0.0.1:${port}/json/version`;
      try {
        const res = await fetch(url);
        if (res.ok) return port;
      } catch {
        // try next port
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`CDP endpoint not ready (tried ${ports.join(", ")})`);
}

/** Spawn Electron with CDP enabled (avoids Playwright _electron.launch flakiness). */
async function launchViaSpawnCdp(): Promise<PerfSession> {
  if (!existsSync(mainEntry)) {
    throw new Error("missing out/main/index.js");
  }

  console.log("[perf] spawning Electron with remote-debugging-port", cdpPort);
  const child = spawn(
    electronExecutable,
    [mainEntry, "--no-sandbox", `--remote-debugging-port=${cdpPort}`],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "production",
        BIGTEX_PERF_PROFILE: process.env.BIGTEX_PERF_PROFILE ?? "1",
        BIGTEX_PERF_CDP: "1",
        BIGTEX_PERF_CDP_PORT: cdpPort,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stderr?.on("data", (chunk: Buffer) => {
    const line = chunk.toString();
    if (line.toLowerCase().includes("error")) process.stderr.write(`[perf:electron] ${line}`);
  });

  try {
    const port = await waitForCdpEndpoint(cdpPort);
    console.log(`[perf] CDP ready on port ${port}`);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    return {
      page,
      browser,
      devProcess: child,
      async close() {
        await browser.close().catch(() => undefined);
        child.kill("SIGTERM");
      },
    };
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
}

async function launchViaPlaywright(): Promise<PerfSession> {
  if (!existsSync(mainEntry)) {
    throw new Error("missing out/main/index.js");
  }

  const electronApp = await electronLauncher.launch({
    args: [mainEntry, "--no-sandbox", `--remote-debugging-port=${cdpPort}`],
    executablePath: electronExecutable,
    env: {
      ...process.env,
      NODE_ENV: "production",
      BIGTEX_PERF_PROFILE: process.env.BIGTEX_PERF_PROFILE ?? "1",
      BIGTEX_PERF_CDP: "1",
      BIGTEX_PERF_CDP_PORT: cdpPort,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    },
  });

  const page = await electronApp.firstWindow();
  return {
    page,
    electronApp,
    async close() {
      await electronApp.close();
    },
  };
}

function spawnElectronVite(command: "preview" | "dev"): ChildProcess {
  const args =
    command === "dev"
      ? ["exec", "electron-vite", "dev", "--", `--remote-debugging-port=${cdpPort}`]
      : ["exec", "electron-vite", "preview"];

  return spawn("pnpm", args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      BIGTEX_PERF_PROFILE: process.env.BIGTEX_PERF_PROFILE ?? "1",
      BIGTEX_PERF_CDP: "1",
      BIGTEX_PERF_CDP_PORT: cdpPort,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function launchViaPreviewCdp(): Promise<PerfSession> {
  if (!existsSync(mainEntry)) {
    throw new Error("missing out/main/index.js — run: pnpm run build");
  }

  console.log("[perf] starting electron-vite preview + CDP");
  const previewProcess = spawnElectronVite("preview");

  previewProcess.stderr?.on("data", (chunk: Buffer) => {
    const line = chunk.toString();
    if (line.toLowerCase().includes("error")) process.stderr.write(`[perf:preview] ${line}`);
  });

  try {
    const port = await waitForCdpEndpoint(cdpPort);
    console.log(`[perf] CDP ready on port ${port}`);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    return {
      page,
      browser,
      devProcess: previewProcess,
      async close() {
        await browser.close().catch(() => undefined);
        previewProcess.kill("SIGTERM");
      },
    };
  } catch (error) {
    previewProcess.kill("SIGTERM");
    throw error;
  }
}

async function launchViaDevCdp(): Promise<PerfSession> {
  console.log("[perf] starting electron-vite dev + CDP");
  const devProcess = spawnElectronVite("dev");

  devProcess.stderr?.on("data", (chunk: Buffer) => {
    const line = chunk.toString();
    if (line.toLowerCase().includes("error")) process.stderr.write(`[perf:dev] ${line}`);
  });

  try {
    const port = await waitForCdpEndpoint(cdpPort);
    console.log(`[perf] CDP ready on port ${port}`);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    return {
      page,
      browser,
      devProcess,
      async close() {
        await browser.close().catch(() => undefined);
        devProcess.kill("SIGTERM");
      },
    };
  } catch (error) {
    devProcess.kill("SIGTERM");
    throw error;
  }
}

/** Preview+CDP (default), then Playwright Electron, then dev+CDP. */
export async function openPerfSession(): Promise<PerfSession> {
  if (process.env.BIGTEX_PERF_DEV === "1") {
    return launchViaDevCdp();
  }

  const attempts: Array<{ name: string; run: () => Promise<PerfSession> }> = [
    { name: "spawn+CDP", run: launchViaSpawnCdp },
    { name: "playwright-electron", run: launchViaPlaywright },
    { name: "preview+CDP", run: launchViaPreviewCdp },
    { name: "dev+CDP", run: launchViaDevCdp },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (error) {
      lastError = error;
      console.warn(`[perf] ${attempt.name} failed:`, error);
    }
  }

  throw new Error("All perf launch methods failed", { cause: lastError });
}
