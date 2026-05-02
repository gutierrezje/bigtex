import type { PerformanceMark } from "../../shared/domain";

const marks: PerformanceMark[] = [];

export function recordMark(name: string, durationMs: number): void {
  marks.push({
    name,
    durationMs,
    at: Date.now(),
  });

  if (marks.length > 250) {
    marks.splice(0, marks.length - 250);
  }
}

export async function measure<T>(name: string, work: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    recordMark(name, Math.round(performance.now() - startedAt));
  }
}

export function getMarks(): PerformanceMark[] {
  return [...marks];
}
