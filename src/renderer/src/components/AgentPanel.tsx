import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { CREATABLE_FILE_EXTENSIONS } from "../../../shared/projectFiles";
import {
  AGENT_MESSAGE_CLASS,
  CHROME_META_CLASS,
  CHROME_SECTION_CLASS,
  CHROME_TITLE_CLASS,
  PANEL_CHROME_ROW_CLASS,
  TREE_LABEL_CLASS,
} from "../lib/treeTypography";
import type { AgentChatState } from "../store";
import { AgentPermissionBanner } from "./AgentPermissionBanner";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentMessageReasoningPart } from "./agent/AgentMessageReasoningPart";
import { AgentMessageTextPart } from "./agent/AgentMessageTextPart";
import { AgentModelToolbar } from "./agent/AgentModelToolbar";
import { BigTexAssistantRuntime } from "./agent/BigTexAssistantRuntime";

function formatSupportedExtensions(extensions: readonly string[]): string {
  if (extensions.length <= 1) return extensions[0] ?? "";
  return `${extensions.slice(0, -1).join(", ")}, or ${extensions[extensions.length - 1]}`;
}

const SUPPORTED_SOURCE_FILES = formatSupportedExtensions(CREATABLE_FILE_EXTENSIONS);

interface AgentPanelProps {
  rootPath: string | null;
  activeFile: string | null;
  chat: AgentChatState;
  onRun(prompt: string, modelId: string, reasoningLevel: string | null): Promise<void>;
  onCancel(runId: string): Promise<void>;
  onApplyPatch(patch: string): Promise<void>;
}

/** Stable part components — no inline lambdas (remount on every stream chunk). */
const agentMessagePartComponents = {
  Text: AgentMessageTextPart,
  Reasoning: AgentMessageReasoningPart,
};

function EmptyThread() {
  return (
    <ThreadPrimitive.Empty>
      <div className="mx-auto grid max-w-[260px] gap-1.5 px-4 py-12 text-center select-none">
        <span className={CHROME_SECTION_CLASS}>ready</span>
        <p className={`m-0 ${CHROME_META_CLASS} text-text-muted`}>
          Ask BigTeX to edit, explain, or repair the selected {SUPPORTED_SOURCE_FILES} source file.
        </p>
      </div>
    </ThreadPrimitive.Empty>
  );
}

function ChatMessage({ onApplyPatch }: { onApplyPatch(patch: string): Promise<void> }) {
  const message = useAuiState((state) => state.message);
  const custom = message.metadata?.custom as { patch?: unknown; activity?: unknown } | undefined;
  const patch = typeof custom?.patch === "string" ? custom.patch : null;
  const activity = typeof custom?.activity === "string" ? custom.activity.trim() : "";
  const isAssistant = message.role === "assistant";

  return (
    <MessagePrimitive.Root
      className={`grid w-full min-w-0 gap-1.5 px-3 py-2 ${message.role === "user" ? "justify-items-end" : "justify-items-start"}`}
    >
      <div
        className={`min-w-0 w-fit max-w-full rounded-md border px-3 py-2 sm:max-w-[92%] ${AGENT_MESSAGE_CLASS} ${
          message.role === "user"
            ? "border-accent/30 bg-accent-muted text-text-primary"
            : message.role === "system"
              ? "border-transparent bg-transparent px-0 text-text-muted"
              : "border-border/50 bg-transparent text-text-primary"
        }`}
      >
        {activity ? (
          <div className="agent-code-block-wrap mb-2 max-h-32 overflow-y-auto">
            <pre
              className={`agent-activity-block agent-code-block agent-code-block--streaming font-mono ${CHROME_META_CLASS} text-text-muted`}
            >
              {activity}
            </pre>
          </div>
        ) : null}
        <MessagePrimitive.Parts components={agentMessagePartComponents} />
      </div>

      {isAssistant ? (
        <div className="flex min-w-0 w-fit max-w-full flex-wrap items-center gap-1.5 sm:max-w-[92%]">
          <ActionBarPrimitive.Root hideWhenRunning={false} className="flex items-center gap-1">
            <ActionBarPrimitive.Copy
              className={`rounded border border-border/60 bg-transparent px-2 py-0.5 ${TREE_LABEL_CLASS} text-text-muted transition-colors duration-100 hover:border-accent/30 hover:text-text-secondary cursor-pointer`}
            >
              Copy
            </ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
          {patch ? (
            <button
              type="button"
              className={`rounded border border-accent/20 bg-accent/8 px-2.5 py-0.5 ${TREE_LABEL_CLASS} text-accent transition-colors duration-100 hover:bg-accent/15 cursor-pointer`}
              onClick={() => onApplyPatch(patch)}
            >
              Apply detected patch
            </button>
          ) : null}
        </div>
      ) : null}
    </MessagePrimitive.Root>
  );
}

interface ChatThreadProps {
  activeFile: string | null;
  onApplyPatch(patch: string): Promise<void>;
}

function AgentComposerContext({ activeFile }: { activeFile: string | null }) {
  return (
    <div
      className={`min-w-0 truncate px-1 pt-0.5 pb-1 ${CHROME_META_CLASS} text-text-muted select-none`}
      title={activeFile ?? undefined}
    >
      <span className="text-text-muted/80">context: </span>
      <span className="font-mono text-text-secondary">{activeFile ?? "none"}</span>
    </div>
  );
}

function ChatThread({ activeFile, onApplyPatch }: ChatThreadProps) {
  return (
    <ThreadPrimitive.Root className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      <ThreadPrimitive.Viewport
        autoScroll
        turnAnchor="bottom"
        className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface py-2"
      >
        <EmptyThread />
        <ThreadPrimitive.Messages>
          {() => <ChatMessage onApplyPatch={onApplyPatch} />}
        </ThreadPrimitive.Messages>
        <ThreadPrimitive.ViewportFooter />
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="border-t border-border/40 bg-surface px-2 pb-2 pt-2">
        <AgentPermissionBanner />
        <AgentComposerContext activeFile={activeFile} />
        <AgentModelToolbar />
        <AgentComposer />
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

export function AgentPanel({
  rootPath,
  activeFile,
  chat,
  onRun,
  onCancel,
  onApplyPatch,
}: AgentPanelProps) {
  return (
    <aside className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-surface-raised">
      <header className={`${PANEL_CHROME_ROW_CLASS} justify-between gap-2 px-2`}>
        <h2
          className={`min-w-0 flex-1 truncate text-text-secondary ${CHROME_TITLE_CLASS}`}
          title={`Assistant for selected ${SUPPORTED_SOURCE_FILES} files`}
        >
          Assistant
        </h2>
        {chat.running ? (
          <button
            type="button"
            className={`shrink-0 rounded border border-danger/30 bg-transparent px-2 py-0.5 ${TREE_LABEL_CLASS} text-danger hover:bg-danger-muted transition-colors cursor-pointer`}
            onClick={() => onCancel(chat.runId)}
          >
            cancel
          </button>
        ) : null}
      </header>

      <BigTexAssistantRuntime disabled={!rootPath} onRun={onRun} onCancel={onCancel}>
        <ChatThread activeFile={activeFile} onApplyPatch={onApplyPatch} />
      </BigTexAssistantRuntime>
    </aside>
  );
}
