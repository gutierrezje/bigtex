import { pickAllowPermissionOption, pickDenyPermissionOption } from "../../../shared/settings";
import { TREE_LABEL_CLASS } from "../lib/treeTypography";
import { useAppStore } from "../store";

export function AgentPermissionBanner() {
  const queue = useAppStore((state) => state.permissionQueue);
  const dequeuePermissionRequest = useAppStore((state) => state.dequeuePermissionRequest);

  const current = queue[0];
  if (!current) return null;

  const allowOnce =
    current.options.find((option) => option.optionId === "once") ??
    pickAllowPermissionOption(current.options);
  const allowSession = current.options.find(
    (option) => option.optionId === "allow-session" || option.kind === "allow_session",
  );
  const deny = pickDenyPermissionOption(current.options);

  async function respond(optionId: string | null): Promise<void> {
    await window.bigTex.settings.respondPermission({
      requestId: current.requestId,
      optionId,
    });
    dequeuePermissionRequest(current.requestId);
  }

  return (
    <div className="mx-2 mb-2 rounded-lg border border-accent/25 bg-accent-muted px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`m-0 ${TREE_LABEL_CLASS} font-medium text-text-primary`}>{current.title}</p>
          {queue.length > 1 ? (
            <p className={`mt-1 mb-0 ${TREE_LABEL_CLASS} text-text-muted`}>
              {queue.length} permission requests pending
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {allowOnce ? (
            <button
              type="button"
              className={`rounded border border-border/60 bg-surface px-2.5 py-1 ${TREE_LABEL_CLASS} text-text-secondary hover:border-accent/30 cursor-pointer`}
              onClick={() => void respond(allowOnce.optionId)}
            >
              Allow once
            </button>
          ) : null}
          {allowSession ? (
            <button
              type="button"
              className={`rounded border border-border/60 bg-surface px-2.5 py-1 ${TREE_LABEL_CLASS} text-text-secondary hover:border-accent/30 cursor-pointer`}
              onClick={() => void respond(allowSession.optionId)}
            >
              Allow for session
            </button>
          ) : null}
          <button
            type="button"
            className={`rounded border border-danger/30 bg-danger-muted px-2.5 py-1 ${TREE_LABEL_CLASS} text-danger hover:border-danger/50 cursor-pointer`}
            onClick={() => void respond(deny?.optionId ?? null)}
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
