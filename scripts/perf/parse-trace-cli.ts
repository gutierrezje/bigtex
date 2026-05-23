/**
 * Re-parse an existing CDP or Playwright trace JSON without launching Electron.
 *
 *   pnpm run perf:parse -- perf-traces/cdp-boot-sample-*.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyzeTrace,
  loadTraceJson,
  summarizeForLlm,
} from "../../src/shared/perf/trace-parse.ts";

const input = process.argv[2];
if (!input) {
  console.error("Usage: pnpm run perf:parse -- <path-to-trace.json>");
  process.exit(1);
}

const path = resolve(input);
const raw = loadTraceJson(readFileSync(path, "utf8"));
const analysis = analyzeTrace(raw, path);
const llm = summarizeForLlm(analysis);
const outPath = path.replace(/\.json$/i, ".llm.json");
writeFileSync(outPath, JSON.stringify(llm, null, 2), "utf8");

console.log(JSON.stringify(llm, null, 2));
console.error(`[perf] wrote ${outPath}`);
