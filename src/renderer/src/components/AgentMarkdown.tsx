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
    if (!className || streaming) return;

    let cancelled = false;
    void getAgentHighlighter().then((loadedHighlighter) => {
      if (!cancelled) setHighlighter(loadedHighlighter);
    });

    return () => {
      cancelled = true;
    };
  }, [className, streaming]);

  if (!className || streaming || !highlighter) {
    return <code className={className}>{children}</code>;
  }

  return (
    <ShikiHighlighter
      highlighter={highlighter}
      language={language}
      theme="github-dark"
      as="pre"
      showLanguage={false}
    >
      {code}
    </ShikiHighlighter>
  );
}

export function AgentMarkdown({ text, streaming }: AgentMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
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
