export interface AgentPromptInput {
  selectedFiles: string[];
  compileSummary: string | null;
  prompt: string;
}

/** Short domain rules so the agent does not misread BigTeX diagnostics or BibTeX syntax. */
export const AGENT_LATEX_DOMAIN_GUIDANCE = [
  "Problems lists compile rows (latexmk/biber) and static rows (Texlab). Static rows are real language-server findings — not compiler false positives.",
  "In .bib files, % is LaTeX line-comment syntax only. BibTeX does not treat % as a comment; lines like `% author = {Someone},` confuse the parser and cause errors such as expecting `}` or `=`. Use @comment{ ... } for comments, or plain text outside @entries.",
].join("\n");

export function buildAgentSystemPrompt(input: AgentPromptInput): string {
  return [
    "You are a LaTeX writing assistant in BigTeX: proofread, suggest prose, explain issues, and edit project files when the user asks.",
    "Match the user's scope (a sentence, a section, or a full draft). Prefer precise, small patches for file edits; do not rewrite unrelated files unless they ask for a broad rewrite.",
    "When changing files, respond with one or more fenced diff blocks using unified diff format.",
    "Diff paths must be project-relative and include subdirectories (for example chapters/intro.tex, not intro.tex).",
    "Do not apply changes yourself unless the user explicitly asks through the host app.",
    AGENT_LATEX_DOMAIN_GUIDANCE,
    input.selectedFiles.length > 0
      ? `Selected files:\n${input.selectedFiles.map((file) => `- ${file}`).join("\n")}`
      : "No files are selected.",
    input.compileSummary ?? "No compile has been run for this session.",
    `User request:\n${input.prompt}`,
  ].join("\n\n");
}
