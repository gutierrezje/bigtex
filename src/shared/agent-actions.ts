export interface BigTexCompileAction {
  kind: "compile";
  reason?: string;
}

export type BigTexAgentAction = BigTexCompileAction;

const ACTION_FENCE_RE = /```bigtex-action\s*([\s\S]*?)```/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseActionRecord(value: unknown): BigTexAgentAction | null {
  if (!isRecord(value) || value.kind !== "compile") return null;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  return reason ? { kind: "compile", reason } : { kind: "compile" };
}

export function extractBigTexAgentAction(text: string): BigTexAgentAction | null {
  const matches = [...text.matchAll(ACTION_FENCE_RE)];
  if (matches.length !== 1) return null;

  try {
    return parseActionRecord(JSON.parse(matches[0]?.[1]?.trim() ?? ""));
  } catch {
    return null;
  }
}

export function stripBigTexAgentActions(text: string): string {
  return text.replace(ACTION_FENCE_RE, "").trim();
}

const COMPILE_NEGATION_RE =
  /\b(?:don't|do not|without|no need to|not)\b[^.!?]{0,80}\b(?:compile|build|verify)\b/;

export function promptRequestsCompile(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  if (COMPILE_NEGATION_RE.test(normalized)) return false;
  return (
    /\bcompile\b/.test(normalized) ||
    /\b(?:build|verify)\b.*\b(?:pdf|latex|tex|document|project)\b/.test(normalized) ||
    /\bcheck\b.*\bpdf\b/.test(normalized) ||
    /\bfix\b.*\bgreen\b/.test(normalized)
  );
}
