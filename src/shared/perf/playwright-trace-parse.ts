/**
 * Parse Playwright 1.60+ `trace.trace` NDJSON (inside trace.zip) into slow action summaries.
 */

export interface PlaywrightTraceAction {
  callId: string;
  class: string;
  method: string;
  title: string;
  durationMs: number;
  startMs: number;
}

interface PlaywrightBefore {
  type: "before";
  callId: string;
  startTime: number;
  class?: string;
  method?: string;
  title?: string;
}

interface PlaywrightAfter {
  type: "after";
  callId: string;
  endTime: number;
}

const SLOW_ACTION_MS = 50;

export function parsePlaywrightTraceNdjson(text: string): PlaywrightTraceAction[] {
  const pending = new Map<string, PlaywrightBefore>();
  const slow: PlaywrightTraceAction[] = [];

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let row: PlaywrightBefore | PlaywrightAfter;
    try {
      row = JSON.parse(line) as PlaywrightBefore | PlaywrightAfter;
    } catch {
      continue;
    }

    if (row.type === "before" && row.callId) {
      pending.set(row.callId, row);
      continue;
    }

    if (row.type === "after" && row.callId) {
      const start = pending.get(row.callId);
      if (!start?.startTime || row.endTime == null) continue;
      const durationMs = row.endTime - start.startTime;
      if (durationMs < SLOW_ACTION_MS) continue;
      slow.push({
        callId: row.callId,
        class: start.class ?? "Unknown",
        method: start.method ?? "unknown",
        title: start.title ?? `${start.class ?? "call"}.${start.method ?? "?"}`,
        durationMs,
        startMs: start.startTime,
      });
    }
  }

  return slow.sort((a, b) => b.durationMs - a.durationMs);
}

export function summarizePlaywrightActions(
  actions: PlaywrightTraceAction[],
): Record<string, unknown> {
  return {
    slowActionThresholdMs: SLOW_ACTION_MS,
    slowActionCount: actions.length,
    slowActions: actions.slice(0, 20).map((a) => ({
      title: a.title,
      class: a.class,
      method: a.method,
      durationMs: Math.round(a.durationMs * 10) / 10,
      atMs: Math.round(a.startMs),
    })),
  };
}
