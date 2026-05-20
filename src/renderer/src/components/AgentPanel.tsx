import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import type { CompileDiagnostic } from "../../../shared/domain";
import type { AgentChatState } from "../store";
import { AgentMessageReasoningPart } from "./agent/AgentMessageReasoningPart";
import { AgentMessageTextPart } from "./agent/AgentMessageTextPart";
import { AgentModelToolbar } from "./agent/AgentModelToolbar";
import { BigTexAssistantRuntime } from "./agent/BigTexAssistantRuntime";

interface AgentPanelProps {
  rootPath: string | null;
  activeFile: string | null;
  diagnostics: CompileDiagnostic[];
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
      <div className="mx-auto grid max-w-[260px] gap-2 px-4 py-10 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
          Ready
        </span>
        <p className="m-0 text-sm leading-relaxed text-text-muted">
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
        className={`min-w-0 w-fit max-w-full rounded-lg border px-3 py-2 text-[13px] leading-relaxed sm:max-w-[92%] ${
          message.role === "user"
            ? "border-accent/30 bg-accent-muted text-text-primary"
            : message.role === "system"
              ? "border-border-subtle bg-transparent text-text-muted"
              : "border-border bg-surface-raised text-text-secondary"
        }`}
      >
        {activity ? (
          <pre className="agent-activity mb-2 max-h-32 min-w-0 max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-zinc-950/60 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-text-muted">
            {activity}
          </pre>
        ) : null}
        <MessagePrimitive.Parts components={agentMessagePartComponents} />
      </div>

      {isAssistant ? (
        <div className="flex min-w-0 w-fit max-w-full flex-wrap items-center gap-1.5 sm:max-w-[92%]">
          <ActionBarPrimitive.Root hideWhenRunning={false} className="flex items-center gap-1">
            <ActionBarPrimitive.Copy className="rounded-md border border-border bg-transparent px-2 py-1 text-[11px] text-text-muted transition-colors duration-100 hover:border-accent/40 hover:text-text-secondary">
              Copy
            </ActionBarPrimitive.Copy>
          </ActionBarPrimitive.Root>
          {patch ? (
            <button
              type="button"
              className="rounded-md border border-accent/30 bg-accent-muted px-2 py-1 text-[11px] font-medium text-accent transition-colors duration-100 hover:bg-accent/20"
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

      <ComposerPrimitive.Root className="border-t border-border-subtle bg-surface-raised p-2">
        {/* Model & Thinking Toolbar */}
        <AgentModelToolbar />

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-surface-inset p-2">
          <ComposerPrimitive.Input
            className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Ask BigTeX to revise, explain, or fix this LaTeX..."
            rows={2}
            submitMode="enter"
          />
          <div className="flex items-end">
            <ComposerPrimitive.Send className="rounded-md border-0 bg-accent px-3 py-2 text-xs font-semibold text-zinc-950 transition-opacity duration-100 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              Send
            </ComposerPrimitive.Send>
          </div>
        </div>
      </ComposerPrimitive.Root>
    </ThreadPrimitive.Root>
  );
}

export function AgentPanel({
  rootPath,
  activeFile,
  diagnostics,
  chat,
  onRun,
  onCancel,
  onApplyPatch,
}: AgentPanelProps) {
  return (
    <aside className="grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-surface-raised">
      <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Agent
          </span>
          <h2 className="mt-0.5 text-sm font-medium">LaTeX editing assistant</h2>
        </div>
        {chat.running ? (
          <button
            type="button"
            className="shrink-0 rounded-md border border-danger/40 bg-transparent px-3 py-1 text-xs font-medium text-danger transition-colors duration-100 hover:bg-danger-muted"
            onClick={() => onCancel(chat.runId)}
          >
            Cancel
          </button>
        ) : null}
      </header>

      <div className="shrink-0 flex justify-between gap-2 px-3 py-2 text-[11px] text-text-muted">
        <span>{activeFile ? `Selected: ${activeFile}` : "No active file"}</span>
        <span>{diagnostics.length} diagnostic(s)</span>
      </div>

      <BigTexAssistantRuntime disabled={!rootPath} onRun={onRun} onCancel={onCancel}>
        <ChatThread onApplyPatch={onApplyPatch} />
      </BigTexAssistantRuntime>
    </aside>
  );
}
