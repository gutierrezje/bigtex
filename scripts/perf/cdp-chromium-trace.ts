import type { Page } from "playwright";
import type { TraceFile } from "../../src/shared/perf/trace-parse.ts";

/** Record a Chromium timeline via CDP; returns null when Electron blocks streaming. */
export async function captureCdpChromiumTrace(
  page: Page,
  work: () => Promise<void>,
): Promise<TraceFile | null> {
  const client = await page.context().newCDPSession(page);

  try {
    await client.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      traceConfig: {
        recordMode: "recordAsMuchAsPossible",
        includedCategories: [
          "devtools.timeline",
          "disabled-by-default-devtools.timeline.frame",
          "blink.user_timing",
          "v8.execute",
          "__metadata",
        ],
      },
    });
  } catch {
    try {
      await client.send("Tracing.start", {
        categories:
          "devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,v8.execute",
        options: "record-as-much-as-possible",
        transferMode: "ReturnAsStream",
      });
    } catch {
      return null;
    }
  }

  await work();

  let end: { stream?: string; data?: string };
  try {
    end = (await client.send("Tracing.end")) as { stream?: string; data?: string };
  } catch {
    return null;
  }

  if (end.data) {
    return JSON.parse(end.data) as TraceFile;
  }

  if (!end.stream) {
    if (process.env.BIGTEX_PERF_DEBUG) {
      console.warn("[perf] CDP Tracing.end: no stream or inline data");
    }
    return null;
  }

  let traceJson = "";
  let eof = false;
  while (!eof) {
    const chunk = (await client.send("IO.read", {
      handle: end.stream,
      size: 1_000_000,
    })) as {
      data?: string;
      eof?: boolean;
      base64Encoded?: boolean;
    };
    if (chunk.base64Encoded && chunk.data) {
      traceJson += Buffer.from(chunk.data, "base64").toString("utf8");
    } else {
      traceJson += chunk.data ?? "";
    }
    eof = Boolean(chunk.eof);
  }
  await client.send("IO.close", { handle: end.stream }).catch(() => undefined);

  if (process.env.BIGTEX_PERF_DEBUG) {
    console.warn(`[perf] CDP trace JSON bytes: ${traceJson.length}`);
  }

  if (!traceJson.trim()) return null;

  try {
    const parsed = JSON.parse(traceJson) as TraceFile;
    if (!parsed.traceEvents?.length && process.env.BIGTEX_PERF_DEBUG) {
      console.warn("[perf] CDP JSON parsed but traceEvents empty");
    }
    return parsed;
  } catch {
    return null;
  }
}
