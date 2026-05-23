import { describe, expect, it } from "vitest";
import { analyzeTrace, summarizeForLlm } from "./trace-parse";

describe("analyzeTrace", () => {
  it("flags complete events at or above 50ms", () => {
    const analysis = analyzeTrace({
      traceEvents: [
        { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 0, dur: 40_000 },
        { name: "Layout", cat: "devtools.timeline", ph: "X", ts: 50_000, dur: 60_000 },
      ],
    });

    expect(analysis.longTasks).toHaveLength(1);
    expect(analysis.longTasks[0].name).toBe("Layout");
    expect(analysis.longTasks[0].durationMs).toBe(60);
  });

  it("clusters paint bursts in a short window", () => {
    const analysis = analyzeTrace({
      traceEvents: [
        { name: "Layout", ph: "X", ts: 0, dur: 1000 },
        { name: "Paint", ph: "X", ts: 5000, dur: 1000 },
        { name: "UpdateLayerTree", ph: "X", ts: 10_000, dur: 1000 },
        { name: "Layout", ph: "X", ts: 15_000, dur: 1000 },
      ],
    });

    expect(analysis.paintBursts.length).toBeGreaterThan(0);
  });

  it("collects user timing and bigtex marks", () => {
    const analysis = analyzeTrace({
      traceEvents: [
        {
          name: "bigtex:store-typing",
          cat: "blink.user_timing",
          ph: "X",
          ts: 0,
          dur: 12_000,
        },
      ],
    });

    expect(analysis.userTimings.some((u) => u.name.includes("bigtex"))).toBe(true);
    const llm = summarizeForLlm(analysis);
    expect(llm.longTaskThresholdMs).toBe(50);
  });
});
