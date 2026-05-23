import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import type { AgentChatState } from "../store";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentMessageReasoningPart } from "./agent/AgentMessageReasoningPart";
import { AgentMessageTextPart } from "./agent/AgentMessageTextPart";
import { AgentModelToolbar } from "./agent/AgentModelToolbar";
import { BigTexAssistantRuntime } from "./agent/BigTexAssistantRuntime";

interface AgentPanelProps {
  rootPath: string | null;
  activeFile: string | null;
  problemCounts: { errors: number; warnings: number } | null;
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
        <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted/70">
          ready
        </span>
        <p className="m-0 text-xs leading-relaxed text-text-muted">
          Ask BigTeX to edit, explain, or repair the selected LaTeX file. ACP output will stream
          here as a chat.
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
        className={`min-w-0 w-fit max-w-full rounded border px-3 py-2 text-[13px] leading-relaxed sm:max-w-[92%] ${
          message.role === "user"
            ? "border-accent/25 bg-accent-muted text-text-primary"
            : message.role === "system"
              ? "border-border-subtle bg-transparent text-text-muted"
              : "border-border bg-surface-raised text-text-secondary"
        }`}
      >
        {activity ? (
          <div className="agent-code-block-wrap mb-2 max-h-32 overflow-y-auto">
            <pre className="agent-activity-block agent-code-block agent-code-block--streaming text-[10px] text-text-muted">
              {activity}
            </pre>
          </div>
        ) : null}
        <MessagePrimitive.Parts components={agentMessagePartComponents} />
      </div>

      {isAssistant ? (
        <div className="flex min-w-0 w-fit max-w-full flex-wrap items-center gap-1.5 sm:max-w-[92%]">
          <ActionBarPrimitive.Root hideWhenRunning={false} className="flex items-center gap-1">
            <ActionBarPrimitive.Copy className="rounded border border-border bg-transparent px-2 py-0.5 text-[10px] text-text-muted transition-colors duration-100 hover:border-accent/30 hover:text-text-secondary cursor-pointer">
              Copy
            </ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
          {patch ? (
            <button
              type="button"
              className="rounded border border-accent/20 bg-accent/8 px-2.5 py-0.5 text-[10px] font-medium text-accent transition-colors duration-100 hover:bg-accent/15 cursor-pointer"
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
  onApplyPatch(patch: string): Promise<void>;
}

function ChatThread({ onApplyPatch }: ChatThreadProps) {
  return (
    <ThreadPrimitive.Root className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      <ThreadPrimitive.Viewport
        autoScroll
        turnAnchor="bottom"
        className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface-inset py-2"
      >
        <EmptyThread />
        <ThreadPrimitive.Messages>
          {() => <ChatMessage onApplyPatch={onApplyPatch} />}
        </ThreadPrimitive.Messages>
        <ThreadPrimitive.ViewportFooter />
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="border-t border-border/40 bg-surface-raised p-2">
        {/* Model & Thinking Toolbar */}
        <AgentModelToolbar />

        <AgentComposer />
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

export function AgentPanel({
  rootPath,
  activeFile,
  problemCounts,
  chat,
  onRun,
  onCancel,
  onApplyPatch,
}: AgentPanelProps) {
  return (
    <aside className="grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-surface-raised">
      <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 select-none">
        <div>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted/70">
            agent
          </span>
          <h2 className="mt-0.5 text-xs font-semibold text-text-secondary leading-none">
            LaTeX editing assistant
          </h2>
        </div>
        {chat.running ? (
          <button
            type="button"
            className="shrink-0 rounded border border-danger/30 bg-transparent px-2 py-0.5 text-[10px] font-medium text-danger hover:bg-danger-muted transition-colors cursor-pointer"
            onClick={() => onCancel(chat.runId)}
          >
            cancel
          </button>
        ) : null}
      </header>

      <div className="shrink-0 flex justify-between gap-2 border-b border-border/40 px-3 py-1.5 text-[10px] text-text-muted/80 select-none">
        <span>{activeFile ? `selected: ${activeFile}` : "no active file"}</span>
        <span>
          {problemCounts
            ? `${problemCounts.errors} error(s), ${problemCounts.warnings} warning(s)`
            : "no compile yet"}
        </span>
      </div>

      <BigTexAssistantRuntime disabled={!rootPath} onRun={onRun} onCancel={onCancel}>
        <ChatThread onApplyPatch={onApplyPatch} />
      </BigTexAssistantRuntime>
    </aside>
  );
}
