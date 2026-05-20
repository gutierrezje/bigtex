import { type ChildProcess, spawn } from "node:child_process";
import {
  baseModelId,
  providerGroupFromModelId,
  sortReasoningVariants,
} from "../../shared/agent-models";

const OPENCODE_COMMAND = "opencode";
const SERVE_START_TIMEOUT_MS = 20_000;
const VARIANTS_CACHE_TTL_MS = 60_000;

interface ProviderModelInfo {
  variants?: Record<string, unknown>;
}

interface ProvidersResponse {
  providers: Array<{
    id: string;
    models?: Record<string, ProviderModelInfo>;
  }>;
}

interface VariantsCacheEntry {
  at: number;
  variantsByModel: Record<string, string[]>;
}

const variantsCache = new Map<string, VariantsCacheEntry>();

export function opencodeShellEnv(): NodeJS.ProcessEnv {
  if (process.platform !== "darwin") return process.env;

  const extra = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
  const current = process.env.PATH ?? "";
  const parts = current.split(":").filter(Boolean);
  for (const dir of extra) {
    if (!parts.includes(dir)) parts.push(dir);
  }
  return { ...process.env, PATH: parts.join(":") };
}

function parseServePort(text: string): number | null {
  const match = text.match(/listening on https?:\/\/127\.0\.0\.1:(\d+)/);
  return match ? Number(match[1]) : null;
}

async function startOpencodeServe(
  rootPath: string,
): Promise<{ port: number; child: ChildProcess }> {
  const child = spawn(OPENCODE_COMMAND, ["serve", "--port", "0", "--hostname", "127.0.0.1"], {
    cwd: rootPath,
    shell: false,
    env: opencodeShellEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  const port = await new Promise<number>((resolve, reject) => {
    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      handler();
    };

    const onChunk = (chunk: Buffer) => {
      const parsed = parseServePort(chunk.toString("utf8"));
      if (parsed) finish(() => resolve(parsed));
    };

    const timeout = setTimeout(() => {
      finish(() => reject(new Error("Timed out waiting for opencode serve")));
    }, SERVE_START_TIMEOUT_MS);

    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("error", (error) => finish(() => reject(error)));
    child.on("exit", (code) => {
      if (!settled) finish(() => reject(new Error(`opencode serve exited (${code ?? "unknown"})`)));
    });
  });

  return { port, child };
}

function stopOpencodeServe(child: ChildProcess): void {
  child.kill("SIGTERM");
}

function variantsFromProvidersResponse(data: ProvidersResponse): Record<string, string[]> {
  const variantsByModel: Record<string, string[]> = {};

  for (const provider of data.providers) {
    if (providerGroupFromModelId(`${provider.id}/placeholder`) === "other") continue;

    for (const [modelId, info] of Object.entries(provider.models ?? {})) {
      const keys = Object.keys(info.variants ?? {}).filter((variant) => variant !== "default");
      if (keys.length === 0) continue;
      variantsByModel[`${provider.id}/${modelId}`] = sortReasoningVariants(keys);
    }
  }

  return variantsByModel;
}

export async function fetchOpencodeVariantsByModel(
  rootPath: string,
): Promise<Record<string, string[]>> {
  const { port, child } = await startOpencodeServe(rootPath);

  try {
    const url = `http://127.0.0.1:${port}/config/providers?directory=${encodeURIComponent(rootPath)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenCode providers request failed (${response.status})`);
    }

    const data = (await response.json()) as ProvidersResponse;
    return variantsFromProvidersResponse(data);
  } finally {
    stopOpencodeServe(child);
  }
}

export async function getOpencodeVariantsByModel(
  rootPath: string,
  options: { force?: boolean } = {},
): Promise<Record<string, string[]>> {
  const cached = variantsCache.get(rootPath);
  if (!options.force && cached && Date.now() - cached.at < VARIANTS_CACHE_TTL_MS) {
    return cached.variantsByModel;
  }

  const variantsByModel = await fetchOpencodeVariantsByModel(rootPath);
  variantsCache.set(rootPath, { at: Date.now(), variantsByModel });
  return variantsByModel;
}

export async function getVariantsForModel(rootPath: string, modelId: string): Promise<string[]> {
  const variantsByModel = await getOpencodeVariantsByModel(rootPath);
  return variantsByModel[baseModelId(modelId)] ?? [];
}

export function clearOpencodeVariantsCache(rootPath?: string): void {
  if (rootPath) variantsCache.delete(rootPath);
  else variantsCache.clear();
}
