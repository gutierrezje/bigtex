import { useAuiState, useMessagePartReasoning } from "@assistant-ui/react";
import { useEffect, useState } from "react";

/** Collapsible thinking block for ACP agent_thought_chunk streams. */
export function AgentMessageReasoningPart() {
  const part = useMessagePartReasoning();
  const messageStatus = useAuiState((state) => state.message.status);
  const isRunning = messageStatus?.type === "running";
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (isRunning) setManualOpen(null);
  }, [isRunning]);

  const open = manualOpen ?? isRunning;
  const text = part.text.trim();
  if (!text) return null;

  return (
    <details
      className={`agent-thinking mb-2 min-w-0 max-w-full rounded-md border border-border-subtle bg-surface-inset/80${isRunning ? " agent-thinking--streaming" : ""}`}
      open={open}
      onToggle={(event) => setManualOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {isRunning ? "Thinking…" : "Thought process"}
      </summary>
      <div className="agent-code-block-wrap max-h-48 overflow-y-auto border-t border-border-subtle">
        <pre className="agent-code-block agent-code-block--streaming px-2.5 py-2 text-[11px] text-text-muted">
          {text}
        </pre>
      </div>
    </details>
  );
}
