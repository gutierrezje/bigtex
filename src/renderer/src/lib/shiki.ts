import { createHighlighterCore, createJavaScriptRegexEngine } from "react-shiki/core";
import type { HighlighterCore } from "shiki/core";

let highlighterPromise: Promise<HighlighterCore> | null = null;

export function normalizeAgentLanguage(language: string): string {
  const normalized = language.toLowerCase();

  if (normalized === "tex") return "latex";
  if (normalized === "patch") return "diff";
  if (normalized === "bash" || normalized === "sh" || normalized === "zsh") return "shellscript";
  if (normalized === "ts") return "typescript";
  if (normalized === "md") return "markdown";
  if (normalized === "yml") return "yaml";

  const supported = new Set([
    "bibtex",
    "diff",
    "json",
    "latex",
    "markdown",
    "shellscript",
    "text",
    "tsx",
    "typescript",
    "yaml",
  ]);

  return supported.has(normalized) ? normalized : "text";
}

export function getAgentHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [import("@shikijs/themes/github-dark")],
    langs: [
      import("@shikijs/langs/bibtex"),
      import("@shikijs/langs/diff"),
      import("@shikijs/langs/json"),
      import("@shikijs/langs/latex"),
      import("@shikijs/langs/markdown"),
      import("@shikijs/langs/shellscript"),
      import("@shikijs/langs/tsx"),
      import("@shikijs/langs/typescript"),
      import("@shikijs/langs/yaml"),
    ],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });

  return highlighterPromise;
}
