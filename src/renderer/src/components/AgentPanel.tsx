import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { useState } from "react";
import type { CompileDiagnostic } from "../../../shared/domain";
import type { AgentChatState } from "../store";
import { BigTexAssistantRuntime } from "./agent/BigTexAssistantRuntime";

interface AgentPanelProps {
  rootPath: string | null;
  activeFile: string | null;
  diagnostics: CompileDiagnostic[];
  chat: AgentChatState;
  onRun(prompt: string): Promise<void>;
  onCancel(runId: string): Promise<void>;
  onApplyPatch(patch: string): Promise<void>;
}

/** Stable part component; inline lambdas in `components` would remount on every stream chunk. */
function AgentMessageTextPart() {
  return (
    <MessagePartPrimitive.Text
      component="div"
      smooth={false}
      className="agent-output-markdown whitespace-pre-wrap"
    />
  );
}

const agentMessagePartComponents = {
  Text: AgentMessageTextPart,
};

function EmptyThread() {
  return (
    <ThreadPrimitive.Empty>
      <div className="mx-auto grid max-w-[260px] gap-2 px-4 py-10 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
          Ready
        </span>
        <p className="m-0 text-sm leading-relaxed text-text-muted">
          Ask BigTex to edit, explain, or repair the selected LaTeX file. ACP output will stream
          here as a chat.
        </p>
      </div>
    </ThreadPrimitive.Empty>
  );
}

function ChatMessage({ onApplyPatch }: { onApplyPatch(patch: string): Promise<void> }) {
  const message = useAuiState((state) => state.message);
  const custom = message.metadata?.custom as { patch?: unknown } | undefined;
  const patch = typeof custom?.patch === "string" ? custom.patch : null;
  const isAssistant = message.role === "assistant";

  return (
    <MessagePrimitive.Root
      className={`grid gap-1.5 px-3 py-2 ${message.role === "user" ? "justify-items-end" : "justify-items-start"}`}
    >
      <div
        className={`max-w-[92%] rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${
          message.role === "user"
            ? "border-accent/30 bg-accent-muted text-text-primary"
            : message.role === "system"
              ? "border-border-subtle bg-transparent text-text-muted"
              : "border-border bg-surface-raised text-text-secondary"
        }`}
      >
        <MessagePrimitive.Parts components={agentMessagePartComponents} />
      </div>

      {isAssistant ? (
        <div className="flex max-w-[92%] flex-wrap items-center gap-1.5">
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

function ChatThread({ onApplyPatch }: { onApplyPatch(patch: string): Promise<void> }) {
  const [provider, setProvider] = useState<"opencode">("opencode");
  const [model, setModel] = useState<"opencode-acp" | "opencode-lite" | "opencode-deep">(
    "opencode-acp",
  );
  const [thinking, setThinking] = useState<boolean>(true);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  return (
    <ThreadPrimitive.Root className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      <ThreadPrimitive.Viewport
        autoScroll
        turnAnchor="bottom"
        className="min-h-0 overflow-y-auto overscroll-contain bg-surface-inset py-2"
      >
        <EmptyThread />
        <ThreadPrimitive.Messages>
          {() => <ChatMessage onApplyPatch={onApplyPatch} />}
        </ThreadPrimitive.Messages>
        <ThreadPrimitive.ViewportFooter />
      </ThreadPrimitive.Viewport>

      <ComposerPrimitive.Root className="border-t border-border-subtle bg-surface-raised p-2">
        {/* Model & Thinking Toolbar */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1 pb-2">
          {/* Provider Option */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1 rounded-md border border-border bg-surface-inset px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary transition-all duration-100"
              onClick={() => {
                setShowProviderDropdown(!showProviderDropdown);
                setShowModelDropdown(false);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3 text-text-muted"
              >
                <title>Server icon</title>
                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                <line x1="6" x2="6.01" y1="6" y2="6" />
                <line x1="6" x2="6.01" y1="18" y2="18" />
              </svg>
              <span className="text-accent">{provider}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-2.5 w-2.5 text-text-muted"
              >
                <title>Provider List</title>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showProviderDropdown && (
              <div className="absolute bottom-full left-0 z-50 mb-1.5 w-32 rounded-lg border border-border bg-surface-raised p-1 shadow-xl">
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1 text-left text-[11px] font-medium text-accent bg-accent-muted/20"
                  onClick={() => {
                    setProvider("opencode");
                    setShowProviderDropdown(false);
                  }}
                >
                  opencode
                </button>
              </div>
            )}
          </div>

          {/* Model Option */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1 rounded-md border border-border bg-surface-inset px-2 py-0.5 text-[11px] font-medium text-text-secondary hover:border-accent/40 hover:text-text-primary transition-all duration-100"
              onClick={() => {
                setShowModelDropdown(!showModelDropdown);
                setShowProviderDropdown(false);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3 w-3 text-text-muted"
              >
                <title>Processor icon</title>
                <rect width="16" height="16" x="4" y="4" rx="2" />
                <rect width="6" height="6" x="9" y="9" rx="1" />
                <path d="M9 1v3" />
                <path d="M15 1v3" />
                <path d="M9 20v3" />
                <path d="M15 20v3" />
                <path d="M20 9h3" />
                <path d="M20 15h3" />
                <path d="M1 9h3" />
                <path d="M1 15h3" />
              </svg>
              <span className="text-text-primary">
                {model === "opencode-acp" ? "acp" : model === "opencode-lite" ? "lite" : "deep"}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-2.5 w-2.5 text-text-muted"
              >
                <title>Model List</title>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showModelDropdown && (
              <div className="absolute bottom-full left-0 z-50 mb-1.5 w-36 rounded-lg border border-border bg-surface-raised p-1 shadow-xl flex flex-col gap-0.5">
                {(["opencode-acp", "opencode-lite", "opencode-deep"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`w-full rounded-md px-2 py-1 text-left text-[11px] font-medium transition-all ${
                      model === m
                        ? "text-accent bg-accent-muted/20"
                        : "text-text-secondary hover:bg-zinc-800 hover:text-text-primary"
                    }`}
                    onClick={() => {
                      setModel(m);
                      setShowModelDropdown(false);
                      if (m === "opencode-deep") {
                        setThinking(true);
                      }
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-3 w-[1px] bg-border/60 mx-0.5 shrink-0" />

          {/* Thinking Mode Option */}
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all duration-150 ${
              thinking
                ? "border-accent-muted bg-accent-muted/10 text-text-primary"
                : "border-border bg-surface-inset text-text-muted hover:border-accent/40"
            }`}
            onClick={() => setThinking(!thinking)}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                thinking
                  ? "bg-accent shadow-[0_0_6px_var(--color-accent)] animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            <span>Thinking</span>
          </button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border bg-surface-inset p-2">
          <ComposerPrimitive.Input
            className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Ask BigTex to revise, explain, or fix this LaTeX..."
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
    <aside className="grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface-raised">
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
