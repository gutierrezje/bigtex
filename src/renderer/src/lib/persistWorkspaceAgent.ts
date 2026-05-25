import type { AgentModelPreference } from "../../../shared/settings";
import { useAppStore } from "../store";

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePersistWorkspaceAgentModel(
  rootPath: string,
  preference: AgentModelPreference,
): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void window.bigTex.settings.updateWorkspace({
      rootPath,
      patch: { agentModel: preference },
    });
    void useAppStore.getState().refreshEffectiveSettings(rootPath);
  }, 300);
}
