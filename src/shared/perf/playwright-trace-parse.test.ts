import { describe, expect, it } from "vitest";
import { parsePlaywrightTraceNdjson } from "./playwright-trace-parse";

describe("parsePlaywrightTraceNdjson", () => {
  it("extracts before/after pairs slower than 50ms", () => {
    const ndjson = [
      JSON.stringify({
        type: "before",
        callId: "call@1",
        startTime: 100,
        class: "Page",
        method: "click",
        title: "Click button",
      }),
      JSON.stringify({ type: "after", callId: "call@1", endTime: 200 }),
      JSON.stringify({
        type: "before",
        callId: "call@2",
        startTime: 300,
        class: "Page",
        method: "wait",
      }),
      JSON.stringify({ type: "after", callId: "call@2", endTime: 330 }),
    ].join("\n");

    const slow = parsePlaywrightTraceNdjson(ndjson);
    expect(slow).toHaveLength(1);
    expect(slow[0].durationMs).toBe(100);
    expect(slow[0].method).toBe("click");
  });
});
