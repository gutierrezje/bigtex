export interface AgentPromptInput {
  projectName: string | null;
  activeEditorPath: string | null;
  activePdfPath: string | null;
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
  const workspaceContext = [
    input.projectName ? `Project: ${input.projectName}` : "Project: unknown",
    input.activeEditorPath ? `Active editor file: ${input.activeEditorPath}` : "Active editor file: none",
    input.activePdfPath ? `Active PDF: ${input.activePdfPath}` : "Active PDF: none",
    input.selectedFiles.length > 0
      ? `Context hint files:\n${input.selectedFiles.map((file) => `- ${file}`).join("\n")}`
      : "Context hint files: none",
  ].join("\n");

  return [
    "You are a full-capability project agent inside BigTeX: inspect files, search the project, reason about code and LaTeX structure, proofread, explain issues, edit project files, and run project tools when the user asks.",
    "BigTeX is PDF-focused. Keep work anchored to the LaTeX source, compile state, Problems, and the active PDF. When the user asks to build, verify, fix until green, or check the PDF, prefer the host app's BigTeX compile flow over running latexmk yourself.",
    'To ask BigTeX to compile through the host app, end your response with exactly one fenced block: ```bigtex-action\n{"kind":"compile","reason":"short reason"}\n```. Do this after edits when compile/PDF verification is needed. BigTeX will compile, update Problems/PDF, then send you the compile result.',
    "Match the user's scope (a sentence, a section, or a full draft). The active editor file and context hint files are starting points, not hard limits; inspect other project files when needed. Do not rewrite unrelated files unless they ask for a broad rewrite.",
    "You may edit files directly through your available OpenCode tools when the user asks for changes. If you instead propose a reviewable edit, respond with one or more fenced diff blocks using unified diff format.",
    "Diff paths must be project-relative and include subdirectories (for example chapters/intro.tex, not intro.tex).",
    AGENT_LATEX_DOMAIN_GUIDANCE,
    workspaceContext,
    input.compileSummary ?? "No compile has been run for this session.",
    `User request:\n${input.prompt}`,
  ].join("\n\n");
}
