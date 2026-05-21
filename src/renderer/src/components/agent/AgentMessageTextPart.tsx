import { useMessagePartText } from "@assistant-ui/react";
import { prepareAgentMarkdown } from "../../lib/agent-markdown";
import { AgentMarkdown } from "../AgentMarkdown";

/** Renders assistant text through markdown + Shiki (LaTeX, diff, etc.). */
export function AgentMessageTextPart() {
  const part = useMessagePartText();
  const streaming = part.status.type === "running";

  return (
    <div
      className={`agent-output-markdown min-w-0 w-full max-w-full${streaming ? " agent-output-markdown--streaming" : ""}`}
    >
      <AgentMarkdown text={prepareAgentMarkdown(part.text, streaming)} streaming={streaming} />
    </div>
  );
}
