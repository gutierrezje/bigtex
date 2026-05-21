import { type ReactNode, useEffect, useState } from "react";
import ShikiHighlighter from "react-shiki/core";
import type { HighlighterCore } from "shiki/core";
import { getAgentHighlighter, normalizeAgentLanguage } from "../../lib/shiki";

function languageFromClassName(className: string | undefined): string {
  const match = className?.match(/language-(\w+)/);
  return match?.[1] ?? "text";
}

interface AgentCodeBlockProps {
  className?: string;
  children: ReactNode;
  streaming: boolean;
}

/** Block code / diff / LaTeX: horizontal scroll inside the agent column, no word-breaking. */
export function AgentCodeBlock({ className, children, streaming }: AgentCodeBlockProps) {
  const [highlighter, setHighlighter] = useState<HighlighterCore | null>(null);
  const language = normalizeAgentLanguage(languageFromClassName(className));
  const code = String(children).replace(/\n$/, "");
  const isBlock = Boolean(className) || code.includes("\n");

  useEffect(() => {
    if (!isBlock || streaming) return;

    let cancelled = false;
    void getAgentHighlighter().then((loaded) => {
      if (!cancelled) setHighlighter(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [className, isBlock, streaming]);

  if (!isBlock) {
    return <code className="agent-inline-code">{children}</code>;
  }

  const showLanguage = language === "latex" || language === "diff" || language === "bibtex";
  const label = showLanguage ? language : null;

  if (!streaming && highlighter) {
    return (
      <div className="agent-code-block-wrap">
        {label ? <span className="agent-code-block-label">{label}</span> : null}
        <ShikiHighlighter
          highlighter={highlighter}
          language={language}
          theme="github-dark"
          as="pre"
          showLanguage={false}
          className="agent-code-block"
        >
          {code}
        </ShikiHighlighter>
      </div>
    );
  }

  return (
    <div className="agent-code-block-wrap">
      {label ? <span className="agent-code-block-label">{label}</span> : null}
      <pre className={`agent-code-block${streaming ? " agent-code-block--streaming" : ""}`}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}
