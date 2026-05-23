/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BIGTEX_PERF: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface BigTexPerfBridge {
  loadSampleProject(): Promise<void>;
  stressStoreUpdates(iterations: number): Promise<void>;
  getUserTimingEntries(): PerformanceEntry[];
}

interface Window {
  __BIGTEX_PERF__?: BigTexPerfBridge;
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs?url" {
  const workerUrl: string;
  export default workerUrl;
}
