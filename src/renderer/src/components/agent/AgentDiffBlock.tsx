import { useState } from "react";
import { usePatchApply } from "../../context/PatchApplyContext";

// ─── Patch Parser ─────────────────────────────────────────────────────────────

interface DiffLine {
  kind: "add" | "del" | "context" | "hunk";
  text: string;
}

export interface ParsedDiffFile {
  path: string;
  adds: number;
  dels: number;
  lines: DiffLine[];
}

/** Parse a unified diff string into per-file structures. */
export function parsePatch(patch: string): ParsedDiffFile[] {
  const files: ParsedDiffFile[] = [];
  let current: ParsedDiffFile | null = null;

  for (const raw of patch.split(/\r?\n/)) {
    if (raw.startsWith("+++ ")) {
      const rawPath = raw.slice(4).trim().split("\t")[0] ?? "";
      const path = rawPath.replace(/^(?:a|b)\//, "");
      if (path && path !== "/dev/null") {
        current = { path, adds: 0, dels: 0, lines: [] };
        files.push(current);
      }
      continue;
    }
    if (raw.startsWith("--- ")) continue;
    if (!current) continue;

    if (raw.startsWith("@@ ")) {
      current.lines.push({ kind: "hunk", text: raw });
    } else if (raw.startsWith("+")) {
      current.adds++;
      current.lines.push({ kind: "add", text: raw.slice(1) });
    } else if (raw.startsWith("-")) {
      current.dels++;
      current.lines.push({ kind: "del", text: raw.slice(1) });
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file" — skip
    } else {
      current.lines.push({
        kind: "context",
        text: raw.startsWith(" ") ? raw.slice(1) : raw,
      });
    }
  }

  return files.filter((f) => f.lines.length > 0);
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function FileIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-text-muted"
    >
      <path
        d="M2.5 1.5H7.5L10.5 4.5V11.5H2.5V1.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M7.5 1.5V4.5H10.5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path
        d="M2 5.5L4.5 8L9 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── File card ────────────────────────────────────────────────────────────────

type ApplyState = "idle" | "applying" | "applied";

function fileBasename(path: string): string {
  return path.split("/").pop() ?? path;
}

function DiffFileCard({ file, fullPatch }: { file: ParsedDiffFile; fullPatch: string }) {
  const onApply = usePatchApply();
  const [applyState, setApplyState] = useState<ApplyState>("idle");

  async function handleApply() {
    if (!onApply || applyState !== "idle") return;
    setApplyState("applying");
    try {
      await onApply(fullPatch);
      setApplyState("applied");
    } catch {
      setApplyState("idle");
    }
  }

  const basename = fileBasename(file.path);

  return (
    <div className="agent-diff-card">
      {/* Header */}
      <div className="agent-diff-header">
        <FileIcon />
        <span className="agent-diff-filename" title={file.path}>
          {basename}
        </span>
        <div className="agent-diff-stats">
          {file.adds > 0 && <span className="agent-diff-stat-add">+{file.adds}</span>}
          {file.dels > 0 && <span className="agent-diff-stat-del">−{file.dels}</span>}
        </div>
        {onApply ? (
          <button
            type="button"
            disabled={applyState !== "idle"}
            className={`agent-diff-apply-btn${applyState === "applied" ? " agent-diff-apply-btn--applied" : ""}`}
            onClick={() => void handleApply()}
          >
            {applyState === "applying" ? (
              <span className="agent-diff-spinner" role="status" title="Applying…" />
            ) : applyState === "applied" ? (
              <>
                <CheckIcon />
                Applied
              </>
            ) : (
              "Apply"
            )}
          </button>
        ) : null}
      </div>

      {/* Body */}
      <section className="agent-diff-body" aria-label={`Changes to ${basename}`}>
        {file.lines.map((line, i) =>
          line.kind === "hunk" ? (
            <div key={i} className="agent-diff-line agent-diff-line--hunk">
              <span className="agent-diff-gutter" aria-hidden />
              <span className="agent-diff-line-text">{line.text}</span>
            </div>
          ) : (
            <div
              key={i}
              className={`agent-diff-line${
                line.kind === "add"
                  ? " agent-diff-line--add"
                  : line.kind === "del"
                    ? " agent-diff-line--del"
                    : ""
              }`}
            >
              <span className="agent-diff-gutter" aria-hidden>
                {line.kind === "add" ? "+" : line.kind === "del" ? "−" : ""}
              </span>
              <span className="agent-diff-line-text">{line.text}</span>
            </div>
          ),
        )}
      </section>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function AgentDiffBlock({
  files,
  fullPatch,
}: {
  files: ParsedDiffFile[];
  fullPatch: string;
}) {
  return (
    <div className="agent-diff-stack">
      {files.map((file) => (
        <DiffFileCard key={file.path} file={file} fullPatch={fullPatch} />
      ))}
    </div>
  );
}
