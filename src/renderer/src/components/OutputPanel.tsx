import { useEffect, useMemo, useRef } from "react";
import type { PerformanceMark } from "../../../shared/domain";
import type { OutputEntry, OutputLevel } from "../store";
import { useAppStore } from "../store";

type TimelineItem =
  | { kind: "log"; at: number; entry: OutputEntry }
  | { kind: "metric"; at: number; mark: PerformanceMark };

function levelClass(level: OutputLevel): string {
  switch (level) {
    case "success":
      return "text-accent";
    case "warning":
      return "text-amber-400";
    case "error":
      return "text-danger";
    default:
      return "text-text-secondary";
  }
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function OutputPanel() {
  const outputLog = useAppStore((state) => state.outputLog);
  const metrics = useAppStore((state) => state.metrics);
  const clearOutputLog = useAppStore((state) => state.clearOutputLog);
  const refreshMetrics = useAppStore((state) => state.refreshMetrics);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [
      ...outputLog.map((entry) => ({ kind: "log" as const, at: entry.at, entry })),
      ...metrics.map((mark) => ({ kind: "metric" as const, at: mark.at, mark })),
    ];
    return items.sort((left, right) => left.at - right.at);
  }, [outputLog, metrics]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [timeline.length]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border/40 px-2 py-1">
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[10px] font-medium text-text-muted transition-colors duration-100 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
          disabled={outputLog.length === 0}
          onClick={() => clearOutputLog()}
        >
          Clear messages
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed"
      >
        {timeline.length ? (
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {timeline.map((item) =>
              item.kind === "log" ? (
                <OutputLine key={item.entry.id} entry={item.entry} />
              ) : (
                <MetricLine key={`${item.mark.name}-${item.mark.at}`} mark={item.mark} />
              ),
            )}
          </ul>
        ) : (
          <p className="m-0 px-1 text-xs text-text-muted">
            Compile, agent, file messages, and timing marks appear here.
          </p>
        )}
      </div>
    </div>
  );
}

function OutputLine({ entry }: { entry: OutputEntry }) {
  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)] gap-2 px-1 py-0.5 ${levelClass(entry.level)}`}
    >
      <span className="shrink-0 text-text-muted">{formatTime(entry.at)}</span>
      <span className="min-w-0 whitespace-pre-wrap break-words">{entry.message}</span>
    </li>
  );
}

function MetricLine({ mark }: { mark: PerformanceMark }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 px-1 py-0.5 text-text-muted">
      <span className="shrink-0">{formatTime(mark.at)}</span>
      <span className="min-w-0">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">perf </span>
        {mark.name}: {Math.round(mark.durationMs)}ms
      </span>
    </li>
  );
}
