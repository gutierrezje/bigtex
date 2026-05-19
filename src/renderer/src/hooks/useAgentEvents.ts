import { useEffect } from "react";
import type { AgentEvent } from "../../../shared/domain";
import { useAppStore } from "../store";

export function useAgentEvents(
  onFilesChanged?: (event: Extract<AgentEvent, { type: "filesChanged" }>) => void,
): void {
  const appendAgentEvent = useAppStore((state) => state.appendAgentEvent);

  useEffect(
    () =>
      window.bigTex.agent.onEvent((event) => {
        appendAgentEvent(event);
        if (event.type === "filesChanged") onFilesChanged?.(event);
      }),
    [appendAgentEvent, onFilesChanged],
  );
}
