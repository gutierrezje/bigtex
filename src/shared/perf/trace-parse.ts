/**
 * Chrome / Playwright trace.json parser for LLM-friendly perf summaries.
 * @see scripts/perf/README.md
 */

export interface TraceEvent {
  name?: string;
  cat?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  args?: Record<string, unknown>;
  pid?: number;
  tid?: number;
}

export interface TraceFile {
  traceEvents?: TraceEvent[];
  metadata?: Record<string, unknown>;
}

export interface LongTaskSummary {
  name: string;
  category: string;
  durationMs: number;
  tsMs: number;
  pid?: number;
  tid?: number;
}

export interface PaintBurstSummary {
  layoutCount: number;
  paintCount: number;
  updateLayerCount: number;
  windowMs: number;
  startMs: number;
}

export interface UserTimingSummary {
  name: string;
  durationMs: number;
  startMs: number;
  entryType: string;
}

export interface TraceAnalysis {
  sourcePath: string;
  eventCount: number;
  durationMs: number;
  longTasks: LongTaskSummary[];
  paintBursts: PaintBurstSummary[];
  userTimings: UserTimingSummary[];
  reactRelated: LongTaskSummary[];
  topDurationEvents: LongTaskSummary[];
}

const LONG_TASK_MS = 50;
const PAINT_EVENT_NAMES = new Set(["Layout", "UpdateLayerTree", "Paint", "CompositeLayers"]);
const REACT_NAME_RE = /react|scheduler|commit|render|Profiler|fiber|bigtex|BigTeX/i;

function microToMs(micro: number | undefined): number {
  if (micro == null || Number.isNaN(micro)) return 0;
  return micro / 1000;
}

function readEvents(raw: TraceFile): TraceEvent[] {
  const events = raw.traceEvents ?? [];
  return events.filter((e) => typeof e.ts === "number");
}

function eventDurationMs(event: TraceEvent): number {
  if (typeof event.dur === "number" && event.dur > 0) return microToMs(event.dur);
  return 0;
}

function isCompleteEvent(event: TraceEvent): boolean {
  return event.ph === "X" || event.ph === "b";
}

export function analyzeTrace(raw: TraceFile, sourcePath = "trace"): TraceAnalysis {
  const events = readEvents(raw);
  if (events.length === 0) {
    return {
      sourcePath,
      eventCount: 0,
      durationMs: 0,
      longTasks: [],
      paintBursts: [],
      userTimings: [],
      reactRelated: [],
      topDurationEvents: [],
    };
  }

  const minTs = Math.min(...events.map((e) => e.ts ?? 0));
  const maxTs = Math.max(...events.map((e) => (e.ts ?? 0) + (e.dur ?? 0)));
  const durationMs = microToMs(maxTs - minTs);

  const longTasks: LongTaskSummary[] = [];
  const userTimings: UserTimingSummary[] = [];
  const paintHits: Array<{ name: string; tsMs: number }> = [];

  for (const event of events) {
    const name = event.name ?? "(anonymous)";
    const category = event.cat ?? "";
    const tsMs = microToMs((event.ts ?? 0) - minTs);
    const durationMs = eventDurationMs(event);

    if (
      category.includes("blink.user_timing") ||
      name.startsWith("bigtex:") ||
      name.startsWith("react:")
    ) {
      userTimings.push({
        name,
        durationMs,
        startMs: tsMs,
        entryType: category.includes("blink.user_timing") ? "mark/measure" : "trace",
      });
    }

    if (PAINT_EVENT_NAMES.has(name)) {
      paintHits.push({ name, tsMs });
    }

    if (!isCompleteEvent(event) || durationMs < LONG_TASK_MS) continue;

    const summary: LongTaskSummary = {
      name,
      category,
      durationMs,
      tsMs,
      pid: event.pid,
      tid: event.tid,
    };
    longTasks.push(summary);
  }

  longTasks.sort((a, b) => b.durationMs - a.durationMs);

  const reactRelated = longTasks.filter(
    (t) => REACT_NAME_RE.test(t.name) || REACT_NAME_RE.test(t.category),
  );

  const paintBursts = clusterPaintBursts(paintHits, 32);

  return {
    sourcePath,
    eventCount: events.length,
    durationMs,
    longTasks: longTasks.slice(0, 80),
    paintBursts: paintBursts.slice(0, 20),
    userTimings: userTimings.sort((a, b) => b.durationMs - a.durationMs).slice(0, 60),
    reactRelated: reactRelated.slice(0, 40),
    topDurationEvents: longTasks.slice(0, 25),
  };
}

function clusterPaintBursts(
  hits: Array<{ name: string; tsMs: number }>,
  windowMs: number,
): PaintBurstSummary[] {
  if (hits.length === 0) return [];

  const sorted = [...hits].sort((a, b) => a.tsMs - b.tsMs);
  const bursts: PaintBurstSummary[] = [];
  let start = sorted[0].tsMs;
  let layoutCount = 0;
  let paintCount = 0;
  let updateLayerCount = 0;

  function flush(endMs: number): void {
    const total = layoutCount + paintCount + updateLayerCount;
    if (total >= 3) {
      bursts.push({
        layoutCount,
        paintCount,
        updateLayerCount,
        windowMs: endMs - start,
        startMs: start,
      });
    }
    layoutCount = 0;
    paintCount = 0;
    updateLayerCount = 0;
  }

  for (const hit of sorted) {
    if (hit.tsMs - start > windowMs) {
      flush(hit.tsMs);
      start = hit.tsMs;
    }
    if (hit.name === "Layout") layoutCount += 1;
    else if (hit.name === "Paint" || hit.name === "CompositeLayers") paintCount += 1;
    else if (hit.name === "UpdateLayerTree") updateLayerCount += 1;
  }
  flush(sorted[sorted.length - 1].tsMs + windowMs);

  return bursts.sort(
    (a, b) =>
      b.layoutCount +
      b.paintCount +
      b.updateLayerCount -
      (a.layoutCount + a.paintCount + a.updateLayerCount),
  );
}

/** Compact JSON suitable for LLM context (drops raw trace). */
export function summarizeForLlm(analysis: TraceAnalysis): Record<string, unknown> {
  return {
    source: analysis.sourcePath,
    eventCount: analysis.eventCount,
    traceDurationMs: Math.round(analysis.durationMs),
    longTaskThresholdMs: LONG_TASK_MS,
    longTaskCount: analysis.longTasks.length,
    longTasks: analysis.longTasks.slice(0, 15).map((t) => ({
      name: t.name,
      category: t.category,
      durationMs: Math.round(t.durationMs * 10) / 10,
      atMs: Math.round(t.tsMs),
    })),
    reactRelated: analysis.reactRelated.slice(0, 10).map((t) => ({
      name: t.name,
      durationMs: Math.round(t.durationMs * 10) / 10,
      atMs: Math.round(t.tsMs),
    })),
    paintBursts: analysis.paintBursts.slice(0, 8),
    userTimings: analysis.userTimings.slice(0, 20).map((u) => ({
      name: u.name,
      durationMs: Math.round(u.durationMs * 10) / 10,
      atMs: Math.round(u.startMs),
    })),
    notes: [
      "Long tasks use Chromium complete events (ph=X) with dur >= 50ms.",
      "React component names require react-dom/profiling build or bigtex: User Timing marks.",
    ],
  };
}

export function loadTraceJson(text: string): TraceFile {
  return JSON.parse(text) as TraceFile;
}

/** Playwright trace.zip contains trace.traceEvents; pass extracted JSON string. */
export function extractTraceEventsFromPlaywrightExport(raw: TraceFile): TraceFile {
  if (raw.traceEvents) return raw;
  return raw;
}
