import { type ReactNode, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import ShikiHighlighter from "react-shiki/core";
import remarkGfm from "remark-gfm";
import type { HighlighterCore } from "shiki/core";
import { getAgentHighlighter, normalizeAgentLanguage } from "../lib/shiki";

interface AgentMarkdownProps {
  text: string;
  streaming: boolean;
}

function languageFromClassName(className: string | undefined): string {
  const match = className?.match(/language-(\w+)/);
  return match?.[1] ?? "text";
}

function CodeBlock({
  className,
  children,
  streaming,
}: {
  className?: string;
  children: ReactNode;
  streaming: boolean;
}) {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const language = normalizeAgentLanguage(languageFromClassName(className));
  const code = String(children).replace(/\n$/, "");

  useEffect(() => {
    const isBlock = Boolean(className) || code.includes("\n");
    if (!isBlock || streaming) return;

    let cancelled = false;
    void getAgentHighlighter().then((loadedHighlighter) => {
      if (!cancelled) setHighlighter(loadedHighlighter);
    });

    return () => {
      cancelled = true;
    };
  }, [className, code, streaming]);

  const isBlock = Boolean(className) || code.includes("\n");

  if (!isBlock) {
    return <code className="agent-inline-code">{children}</code>;
  }

  if (streaming || !highlighter) {
    return (
      <div className="agent-code-block-wrap">
        <pre className="agent-code-block agent-code-block--streaming">
          <code className={className}>{children}</code>
        </pre>
      </div>
    );
  }

  const showLanguage = language === "latex" || language === "diff" || language === "bibtex";

  return (
    <div className="agent-code-block-wrap">
      <ShikiHighlighter
        highlighter={highlighter}
        language={language}
        theme="github-dark"
        as="pre"
        showLanguage={showLanguage}
        className="agent-code-block"
      >
        {code}
      </ShikiHighlighter>
    </div>
  );
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
            <CodeBlock className={className} streaming={streaming}>
              {children}
            </CodeBlock>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
