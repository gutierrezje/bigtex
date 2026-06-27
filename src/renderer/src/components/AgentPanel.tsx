import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import type { CompileResult } from "../../../shared/domain";
import { CREATABLE_FILE_EXTENSIONS } from "../../../shared/projectFiles";
import { PatchApplyContext } from "../context/PatchApplyContext";
import {
  AGENT_MESSAGE_CLASS,
  CHROME_META_CLASS,
  CHROME_SECTION_CLASS,
  CHROME_TITLE_CLASS,
  PANEL_CHROME_ROW_CLASS,
  TREE_LABEL_CLASS,
} from "../lib/treeTypography";
import type { AgentChatState, AgentMessagePatch } from "../store";
import { AgentPermissionBanner } from "./AgentPermissionBanner";
import { AgentComposer } from "./agent/AgentComposer";
import { AgentDiffBlock, parsePatch } from "./agent/AgentDiffBlock";
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
  activePdf: string | null;
  compileResult: CompileResult | null;
  chat: AgentChatState;
  onRun(prompt: string, modelId: string, reasoningLevel: string | null): Promise<void>;
  onCancel(runId: string): Promise<void>;
  onClearChat(): void;
  onApplyPatch(patch: string): Promise<void>;
}

/** Stable part components — no inline lambdas (remount on every stream chunk). */
const agentMessagePartComponents = {
  Text: AgentMessageTextPart,
  Reasoning: AgentMessageReasoningPart,
};

function patchBadge(patch: AgentMessagePatch): string {
  if (patch.status === "applied") return "Applied by agent";
  return "Detected patch";
}

function MessagePatchBlock({ patch }: { patch: AgentMessagePatch }) {
  const files = parsePatch(patch.patch);
  if (files.length === 0) return null;
  return (
    <div className="mt-2 w-full">
      <AgentDiffBlock
        files={files}
        fullPatch={patch.patch}
        applyable={patch.status === "proposed"}
        badge={patchBadge(patch)}
      />
    </div>
  );
}

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

function ChatMessage() {
  const message = useAuiState((state) => state.message);
  const custom = message.metadata?.custom as
    | { activity?: unknown; patch?: AgentMessagePatch | null }
    | undefined;
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
        {isAssistant && custom?.patch ? (
          <MessagePatchBlock patch={custom.patch as AgentMessagePatch} />
        ) : null}
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
        </div>
      ) : null}
    </MessagePrimitive.Root>
  );
}

interface ChatThreadProps {
  activeFile: string | null;
  activePdf: string | null;
  compileResult: CompileResult | null;
  onApplyPatch(patch: string): Promise<void>;
}

function compileContextLabel(compileResult: CompileResult | null): string {
  if (!compileResult) return "not run";
  return compileResult.success
    ? `clean · ${compileResult.durationMs}ms`
    : `needs attention · ${compileResult.durationMs}ms`;
}

function AgentComposerContext({
  activeFile,
  activePdf,
  compileResult,
}: {
  activeFile: string | null;
  activePdf: string | null;
  compileResult: CompileResult | null;
}) {
  const title = [
    `source: ${activeFile ?? "none"}`,
    `pdf: ${activePdf ?? "none"}`,
    `compile: ${compileContextLabel(compileResult)}`,
  ].join(" · ");

  return (
    <div
      className={`min-w-0 truncate px-1 pt-0.5 pb-1 ${CHROME_META_CLASS} text-text-muted select-none`}
      title={title}
    >
      <span className="text-text-muted/80">source: </span>
      <span className="font-mono text-text-secondary">{activeFile ?? "none"}</span>
      <span className="px-1.5 text-text-muted/60">·</span>
      <span className="text-text-muted/80">pdf: </span>
      <span className="font-mono text-text-secondary">{activePdf ?? "none"}</span>
      <span className="px-1.5 text-text-muted/60">·</span>
      <span className="text-text-muted/80">compile: </span>
      <span className="text-text-secondary">{compileContextLabel(compileResult)}</span>
    </div>
  );
}

function ChatThread({ activeFile, activePdf, compileResult, onApplyPatch }: ChatThreadProps) {
  return (
    <PatchApplyContext.Provider value={onApplyPatch}>
      <ThreadPrimitive.Root className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
        <ThreadPrimitive.Viewport
          autoScroll
          turnAnchor="bottom"
          className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-surface py-2"
        >
          <EmptyThread />
          <ThreadPrimitive.Messages>{() => <ChatMessage />}</ThreadPrimitive.Messages>
          <ThreadPrimitive.ViewportFooter />
        </ThreadPrimitive.Viewport>

        <ComposerPrimitive.Root className="border-t border-border/40 bg-surface px-2 pb-2 pt-2">
          <AgentPermissionBanner />
          <AgentComposerContext
            activeFile={activeFile}
            activePdf={activePdf}
            compileResult={compileResult}
          />
          <AgentModelToolbar />
          <AgentComposer />
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </PatchApplyContext.Provider>
  );
}

export function AgentPanel({
  rootPath,
  activeFile,
  activePdf,
  compileResult,
  chat,
  onRun,
  onCancel,
  onClearChat,
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
        ) : chat.messages.length > 0 ? (
          <button
            type="button"
            className={`shrink-0 rounded border border-border/60 bg-transparent px-2 py-0.5 ${TREE_LABEL_CLASS} text-text-muted transition-colors duration-100 hover:border-border hover:text-text-secondary cursor-pointer`}
            onClick={onClearChat}
          >
            clear
          </button>
        ) : null}
      </header>

      <BigTexAssistantRuntime disabled={!rootPath} onRun={onRun} onCancel={onCancel}>
        <ChatThread
          activeFile={activeFile}
          activePdf={activePdf}
          compileResult={compileResult}
          onApplyPatch={onApplyPatch}
        />
      </BigTexAssistantRuntime>
    </aside>
  );
}
