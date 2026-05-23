import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  _baseDuration,
  _startTime,
  _commitTime,
) => {
  const name = `react:${id}:${phase}`;
  try {
    performance.measure(name, { duration: actualDuration });
  } catch {
    performance.mark(`${name}-end`);
  }
};

interface PerfProfilerProps {
  id: string;
  children: ReactNode;
}

/** Wraps the app in React.Profiler when VITE_BIGTEX_PERF is set (trace correlation). */
export function PerfProfiler({ id, children }: PerfProfilerProps) {
  if (!import.meta.env.VITE_BIGTEX_PERF) {
    return children;
  }
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
