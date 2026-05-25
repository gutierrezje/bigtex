import { useEffect, useRef } from "react";
import type { AgentEvent } from "../../../shared/domain";
import { useAppStore } from "../store";

interface AgentEventHandlers {
  onFilesChanged?: (event: Extract<AgentEvent, { type: "filesChanged" }>) => void;
  onFinished?: (event: Extract<AgentEvent, { type: "finished" }>) => void;
  onPatch?: (event: Extract<AgentEvent, { type: "patch" }>) => void;
}

export function useAgentEvents(handlers?: AgentEventHandlers): void {
  const appendAgentEvent = useAppStore((state) => state.appendAgentEvent);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(
    () =>
      window.bigTex.agent.onEvent((event) => {
        appendAgentEvent(event);
        if (event.type === "filesChanged") handlersRef.current?.onFilesChanged?.(event);
        if (event.type === "finished") handlersRef.current?.onFinished?.(event);
        if (event.type === "patch") handlersRef.current?.onPatch?.(event);
      }),
    [appendAgentEvent],
  );
}
