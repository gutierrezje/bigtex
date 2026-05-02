import { useEffect } from "react";
import { useAppStore } from "../store";

export function useAgentEvents(): void {
  const appendAgentEvent = useAppStore((state) => state.appendAgentEvent);

  useEffect(() => window.bigTex.agent.onEvent(appendAgentEvent), [appendAgentEvent]);
}
