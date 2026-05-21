import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AgentCodeBlock } from "./agent/AgentCodeBlock";

interface AgentMarkdownProps {
  text: string;
  streaming: boolean;
}

export function AgentMarkdown({ text, streaming }: AgentMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p({ children }) {
          return <p className={streaming ? "agent-streaming-p" : undefined}>{children}</p>;
        },
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className, children }) {
          return (
            <AgentCodeBlock className={className} streaming={streaming}>
              {children}
            </AgentCodeBlock>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
