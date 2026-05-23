/**
 * Boot built BigTeX via Playwright Electron, record Chromium trace, run UI scenarios.
 *
 * Usage:
 *   pnpm run build
 *   pnpm run perf:trace
 *   BIGTEX_PERF_SCENARIO=typing-stress pnpm run perf:trace
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TraceFile } from "../../src/shared/perf/trace-parse.ts";
import {
  parsePlaywrightTraceNdjson,
  summarizePlaywrightActions,
} from "../../src/shared/perf/playwright-trace-parse.ts";
import {
  analyzeTrace,
  extractTraceEventsFromPlaywrightExport,
  loadTraceJson,
  summarizeForLlm,
} from "../../src/shared/perf/trace-parse.ts";
import { captureCdpChromiumTrace } from "./cdp-chromium-trace.ts";
import { openPerfSession } from "./launch-session.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const outDir = join(repoRoot, "perf-traces");
const mainEntry = join(repoRoot, "out/main/index.js");

type Scenario = "boot-sample" | "typing-stress" | "store-stress";

const scenario = (process.env.BIGTEX_PERF_SCENARIO ?? "boot-sample") as Scenario;
const headless = process.env.BIGTEX_PERF_HEADLESS !== "0";

function ensureBuilt(): void {
  if (process.env.BIGTEX_PERF_DEV === "1") return;
  if (existsSync(mainEntry)) return;
  console.error("[perf] Missing out/main/index.js — run: pnpm run build or BIGTEX_PERF_DEV=1");
  process.exit(1);
}

function extractFromZip(zipPath: string, member: string): string | null {
  const tmp = mkdtempSync(join(tmpdir(), "bigtex-trace-"));
  try {
    const unzip = spawnSync("unzip", ["-o", zipPath, "-d", tmp], { encoding: "utf8" });
    if (unzip.status !== 0) return null;
    const filePath = join(tmp, member);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf8");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function extractTraceEventsFromZip(zipPath: string): string | null {
  return extractFromZip(zipPath, "trace.traceEvents");
}

function extractPlaywrightTraceFromZip(zipPath: string): string | null {
  return extractFromZip(zipPath, "trace.trace");
}

async function installLongTaskObserver(page: import("playwright").Page): Promise<void> {
  await page.evaluate(() => {
    const host = window as Window & {
      __bigtexLongTasks?: Array<{ name: string; durationMs: number; startMs: number }>;
    };
    host.__bigtexLongTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          host.__bigtexLongTasks?.push({
            name: entry.name || "longtask",
            durationMs: entry.duration,
            startMs: entry.startTime,
          });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Long Task API unavailable
    }
  });
}

async function readLongTasks(page: import("playwright").Page): Promise<
  Array<{ name: string; durationMs: number; startMs: number }>
> {
  return page
    .evaluate(() => {
      const host = window as Window & {
        __bigtexLongTasks?: Array<{ name: string; durationMs: number; startMs: number }>;
      };
      return host.__bigtexLongTasks ?? [];
    })
    .catch(() => []);
}

async function waitForAppReady(page: import("playwright").Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 60_000 });
  const ready = page
    .getByTestId("welcome-open-sample")
    .or(page.getByTestId("editor-root"))
    .or(page.getByRole("button", { name: /Open Sample Project/i }))
    .or(page.getByText("BigTeX", { exact: true }));
  await ready.first().waitFor({ state: "visible", timeout: 60_000 });
}

async function openSampleProject(page: import("playwright").Page): Promise<void> {
  const sample = page
    .getByTestId("welcome-open-sample")
    .or(page.getByRole("button", { name: /Open Sample Project/i }));
  if (await sample.first().isVisible().catch(() => false)) {
    await sample.first().click();
    await page
      .locator(".monaco-editor")
      .first()
      .waitFor({ state: "visible", timeout: 90_000 })
      .catch(() => {
        console.warn("[perf] Monaco did not appear after sample load; continuing trace");
      });
  }
}

async function scenarioBootSample(page: import("playwright").Page): Promise<void> {
  await waitForAppReady(page);
  await openSampleProject(page);
  await page.waitForTimeout(1200);
}

async function scenarioTypingStress(page: import("playwright").Page): Promise<void> {
  await scenarioBootSample(page);
  const monaco = page.locator(".monaco-editor").first();
  await monaco.click({ timeout: 15_000 });
  for (let i = 0; i < 40; i++) {
    await page.keyboard.type("%");
    await page.keyboard.press("Backspace");
  }
  await page.waitForTimeout(500);
}

async function scenarioStoreStress(page: import("playwright").Page): Promise<void> {
  await scenarioBootSample(page);
  await page.evaluate(async () => {
    const bridge = window.__BIGTEX_PERF__;
    if (!bridge) throw new Error("__BIGTEX_PERF__ bridge missing (build with BIGTEX_PERF_PROFILE=1)");
    await bridge.stressStoreUpdates(120);
  });
  await page.waitForTimeout(300);
}

async function main(): Promise<void> {
  ensureBuilt();
  mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipPath = join(outDir, `trace-${scenario}-${stamp}.zip`);
  const summaryPath = join(outDir, `summary-${scenario}-${stamp}.json`);
  const llmPath = join(outDir, `llm-${scenario}-${stamp}.json`);

  console.log(`[perf] scenario=${scenario} headless=${headless}`);

  const session = await openPerfSession();
  const { page } = session;
  if (!headless) {
    await page.setViewportSize({ width: 1480, height: 920 });
  }

  const runScenario = async () => {
    switch (scenario) {
      case "typing-stress":
        await scenarioTypingStress(page);
        break;
      case "store-stress":
        await scenarioStoreStress(page);
        break;
      default:
        await scenarioBootSample(page);
    }
  };

  let cdpTrace: TraceFile | null = null;
  let rendererLongTasks: Array<{ name: string; durationMs: number; startMs: number }> = [];
  let rendererTimings: Array<{
    name: string;
    entryType: string;
    startMs: number;
    durationMs: number;
  }> = [];

  const tracingContext = session.electronApp?.context() ?? session.browser?.contexts()[0];

  try {
    if (tracingContext) {
      await tracingContext.tracing.start({
        screenshots: true,
        snapshots: true,
        title: "BigTeX perf",
        sources: true,
      });
    }

    await installLongTaskObserver(page);

    cdpTrace = await captureCdpChromiumTrace(page, async () => {
      await runScenario();
    });

    rendererLongTasks = await readLongTasks(page);

    rendererTimings = await page.evaluate(() => {
      const entries = performance
        .getEntriesByType("mark")
        .concat(performance.getEntriesByType("measure"));
      return entries.map((e) => ({
        name: e.name,
        entryType: e.entryType,
        startMs: e.startTime,
        durationMs: e.duration,
      }));
    });

    if (tracingContext) {
      await tracingContext.tracing.stop({ path: zipPath });
    }
  } catch (error) {
    mkdirSync(outDir, { recursive: true });
    const shot = join(outDir, `error-${scenario}-${stamp}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => undefined);
    console.error(`[perf] screenshot: ${shot}`);
    throw error;
  } finally {
    await session.close();
  }

  const tracePath = join(outDir, `trace-events-${scenario}-${stamp}.json`);
  let merged = cdpTrace;
  const playwrightTraceRaw = existsSync(zipPath) ? extractPlaywrightTraceFromZip(zipPath) : null;
  const playwrightSlowActions = playwrightTraceRaw
    ? parsePlaywrightTraceNdjson(playwrightTraceRaw)
    : [];

  if (!merged?.traceEvents?.length) {
    const zipRaw = extractTraceEventsFromZip(zipPath);
    if (zipRaw) {
      writeFileSync(tracePath, zipRaw, "utf8");
      merged = extractTraceEventsFromPlaywrightExport(loadTraceJson(zipRaw));
    }
  } else {
    writeFileSync(tracePath, JSON.stringify(merged), "utf8");
  }

  if (!merged?.traceEvents?.length) {
    console.warn(
      "[perf] No Chromium traceEvents from CDP — using Playwright trace.trace + Long Task API.",
    );
    merged = { traceEvents: [] };
  }

  const analysis = analyzeTrace(merged, tracePath);
  const llm = {
    ...summarizeForLlm(analysis),
    playwright: summarizePlaywrightActions(playwrightSlowActions),
    rendererLongTasks: rendererLongTasks.slice(0, 30),
    rendererPerformanceEntries: rendererTimings.slice(0, 40),
  };
  const summary = {
    scenario,
    capturedAt: new Date().toISOString(),
    artifacts: {
      traceEventsJson: tracePath,
      playwrightZip: existsSync(zipPath) ? zipPath : null,
      cdpCaptured: Boolean(cdpTrace?.traceEvents?.length),
      playwrightTraceParsed: playwrightSlowActions.length > 0,
    },
    analysis,
    playwrightSlowActions,
    rendererLongTasks,
    rendererTimings,
    llm,
  };

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  writeFileSync(llmPath, JSON.stringify(summary.llm, null, 2), "utf8");

  console.log(`[perf] Trace events: ${tracePath}`);
  console.log(`[perf] Playwright zip: ${zipPath}`);
  console.log(`[perf] Summary: ${summaryPath}`);
  console.log(`[perf] LLM slice: ${llmPath}`);
  console.log(
    `[perf] chromium long tasks (>=50ms): ${analysis.longTasks.length}, paint bursts: ${analysis.paintBursts.length}, playwright slow actions: ${playwrightSlowActions.length}, renderer long tasks: ${rendererLongTasks.length}`,
  );
}

main().catch(async (error) => {
  console.error("[perf] failed:", error);
  process.exit(1);
});
