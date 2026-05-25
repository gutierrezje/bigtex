import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc";
import type { AgentPermissionOption, AgentPermissionRequestPayload } from "../../shared/settings";
import {
  permissionRequestTitle,
  pickAllowPermissionOption,
  pickDenyPermissionOption,
} from "../../shared/settings";
import { getEffectiveSettings } from "./store";

type PermissionResolver = (optionId: string | null) => void;

interface QueuedPermission {
  payload: Omit<AgentPermissionRequestPayload, "requestId" | "queueIndex" | "queueTotal">;
  resolve: PermissionResolver;
}

let getWebContents: () => WebContents | null = () => null;
const queue: QueuedPermission[] = [];
let draining = false;
const pendingResolvers = new Map<string, PermissionResolver>();

export function setPermissionWebContentsGetter(getter: () => WebContents | null): void {
  getWebContents = getter;
}

function emitPermissionRequest(payload: AgentPermissionRequestPayload): void {
  const webContents = getWebContents();
  if (!webContents || webContents.isDestroyed()) return;
  webContents.send(IPC_CHANNELS.settingsPermissionRequest, payload);
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const item = queue[0];
      const requestId = randomUUID();
      const webContents = getWebContents();
      if (!webContents || webContents.isDestroyed()) {
        queue.shift();
        item.resolve(null);
        continue;
      }

      const optionId = await new Promise<string | null>((resolve) => {
        pendingResolvers.set(requestId, resolve);
        emitPermissionRequest({
          ...item.payload,
          requestId,
          queueIndex: 1,
          queueTotal: queue.length,
        });
      });
      queue.shift();
      item.resolve(optionId);
    }
  } finally {
    draining = false;
  }
}

export function respondToPermissionRequest(requestId: string, optionId: string | null): boolean {
  const resolve = pendingResolvers.get(requestId);
  if (!resolve) return false;
  pendingResolvers.delete(requestId);
  resolve(optionId);
  return true;
}

export async function resolveAgentPermission(
  runId: string,
  params: {
    options?: AgentPermissionOption[];
    toolName?: string;
    path?: string;
  },
  sessionAllowed: boolean,
): Promise<string | null> {
  const effective = await getEffectiveSettings();
  if (effective.agentPermissionMode === "auto-approve" || sessionAllowed) {
    return pickAllowPermissionOption(params.options ?? [])?.optionId ?? "once";
  }

  return new Promise<string | null>((resolve) => {
    queue.push({
      payload: {
        runId,
        title: permissionRequestTitle(params),
        options: params.options ?? [],
      },
      resolve,
    });
    void drainQueue();
  });
}

export function permissionOutcomeFromChoice(
  options: AgentPermissionOption[],
  optionId: string | null,
): { outcome: "selected"; optionId: string } | { outcome: "cancelled" } {
  if (!optionId) {
    const deny = pickDenyPermissionOption(options);
    if (deny) return { outcome: "selected", optionId: deny.optionId };
    return { outcome: "cancelled" };
  }
  return { outcome: "selected", optionId };
}
