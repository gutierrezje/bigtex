import { useAuiState, useMessagePartReasoning } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { CHROME_META_CLASS, CHROME_SECTION_CLASS } from "../../lib/treeTypography";

/** Collapsible thinking block for OpenCode reasoning streams. */
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
      className={`agent-thinking mb-2 min-w-0 max-w-full rounded-md border border-border/60 bg-surface-raised/30${isRunning ? " agent-thinking--streaming" : ""}`}
      open={open}
      onToggle={(event) => setManualOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className={`cursor-pointer select-none px-2.5 py-1.5 ${CHROME_SECTION_CLASS} font-medium`}
      >
        {isRunning ? "Thinking…" : "Thought process"}
      </summary>
      <div className="agent-code-block-wrap max-h-48 overflow-y-auto border-t border-border-subtle">
        <pre
          className={`agent-code-block agent-code-block--streaming px-2.5 py-2 font-mono ${CHROME_META_CLASS} text-text-muted`}
        >
          {text}
        </pre>
      </div>
    </details>
  );
}
