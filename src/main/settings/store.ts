import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { app } from "electron";
import type {
  AgentModelPreference,
  EffectiveSettings,
  SettingsFile,
  UserSettings,
  WorkspaceSettings,
} from "../../shared/settings";
import {
  DEFAULT_USER_SETTINGS,
  defaultSettingsFile,
  mergeEffectiveSettings,
  normalizeProjectRootKey,
  SETTINGS_FILE_VERSION,
} from "../../shared/settings";

function getStorePath(): string {
  return resolve(app.getPath("userData"), "settings.json");
}

function isAgentModelPreference(value: unknown): value is AgentModelPreference {
  if (!value || typeof value !== "object") return false;
  const record = value as AgentModelPreference;
  return (
    (record.providerGroup === "free" ||
      record.providerGroup === "go" ||
      record.providerGroup === "copilot") &&
    typeof record.modelId === "string" &&
    (record.reasoningLevel === null || typeof record.reasoningLevel === "string")
  );
}

function parseUserSettings(raw: unknown): UserSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_USER_SETTINGS };
  const record = raw as Partial<UserSettings>;
  return {
    agentPermissionMode: record.agentPermissionMode === "auto-approve" ? "auto-approve" : "ask",
    patchApplyMode: record.patchApplyMode === "auto" ? "auto" : "review",
    agentModel: isAgentModelPreference(record.agentModel) ? record.agentModel : null,
    pdfPreviewInverted:
      typeof record.pdfPreviewInverted === "boolean"
        ? record.pdfPreviewInverted
        : DEFAULT_USER_SETTINGS.pdfPreviewInverted,
  };
}

function parseWorkspaceSettings(raw: unknown): WorkspaceSettings {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as WorkspaceSettings;
  return isAgentModelPreference(record.agentModel) ? { agentModel: record.agentModel } : {};
}

function parseSettingsFile(raw: unknown): SettingsFile {
  if (!raw || typeof raw !== "object") return defaultSettingsFile();
  const record = raw as Partial<SettingsFile>;
  const workspaces: Record<string, WorkspaceSettings> = {};
  if (record.workspaces && typeof record.workspaces === "object") {
    for (const [key, value] of Object.entries(record.workspaces)) {
      workspaces[normalizeProjectRootKey(key)] = parseWorkspaceSettings(value);
    }
  }
  return {
    version: SETTINGS_FILE_VERSION,
    user: parseUserSettings(record.user),
    workspaces,
  };
}

let cached: SettingsFile | null = null;

async function readFromDisk(): Promise<SettingsFile> {
  try {
    const data = await readFile(getStorePath(), "utf8");
    return parseSettingsFile(JSON.parse(data));
  } catch {
    return defaultSettingsFile();
  }
}

async function ensureLoaded(): Promise<SettingsFile> {
  if (!cached) cached = await readFromDisk();
  return cached;
}

async function persist(file: SettingsFile): Promise<void> {
  cached = file;
  try {
    await writeFile(getStorePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
  } catch (error) {
    console.error("Failed to write settings.json", error);
  }
}

export async function loadSettingsFile(legacyPdfPreviewInvert?: boolean): Promise<SettingsFile> {
  const file = await ensureLoaded();
  if (legacyPdfPreviewInvert == null) return file;

  if (typeof file.user.pdfPreviewInverted === "boolean") return file;

  const next: SettingsFile = {
    ...file,
    user: {
      ...file.user,
      pdfPreviewInverted: legacyPdfPreviewInvert,
    },
  };
  await persist(next);
  return next;
}

export async function getSettingsFile(): Promise<SettingsFile> {
  return ensureLoaded();
}

export async function getEffectiveSettings(rootPath?: string | null): Promise<EffectiveSettings> {
  const file = await ensureLoaded();
  return mergeEffectiveSettings(file, rootPath ?? null);
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<EffectiveSettings> {
  const file = await ensureLoaded();
  const next: SettingsFile = {
    ...file,
    user: {
      ...file.user,
      ...patch,
    },
  };
  await persist(next);
  return mergeEffectiveSettings(next, null);
}

export async function updateWorkspaceSettings(
  rootPath: string,
  patch: Partial<WorkspaceSettings>,
): Promise<EffectiveSettings> {
  const file = await ensureLoaded();
  const key = normalizeProjectRootKey(rootPath);
  const current = file.workspaces[key] ?? {};
  const nextWorkspace: WorkspaceSettings = { ...current, ...patch };
  const next: SettingsFile = {
    ...file,
    workspaces: {
      ...file.workspaces,
      [key]: nextWorkspace,
    },
  };
  await persist(next);
  return mergeEffectiveSettings(next, rootPath);
}

export async function clearWorkspaceAgentModel(rootPath: string): Promise<EffectiveSettings> {
  const file = await ensureLoaded();
  const key = normalizeProjectRootKey(rootPath);
  const { [key]: _removed, ...rest } = file.workspaces;
  const next: SettingsFile = { ...file, workspaces: rest };
  await persist(next);
  return mergeEffectiveSettings(next, rootPath);
}
