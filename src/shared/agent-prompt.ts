export interface AgentPromptInput {
  selectedFiles: string[];
  compileSummary: string | null;
  prompt: string;
}

export function buildAgentSystemPrompt(input: AgentPromptInput): string {
  return [
    "You are editing a local LaTeX project from inside BigTeX.",
    "Prefer precise, small patches. Do not rewrite unrelated files.",
    "When changing files, respond with one or more fenced diff blocks using unified diff format.",
    "Diff paths must be project-relative and include subdirectories (for example chapters/intro.tex, not intro.tex).",
    "Do not apply changes yourself unless the user explicitly asks through the host app.",
    input.selectedFiles.length > 0
      ? `Selected files:\n${input.selectedFiles.map((file) => `- ${file}`).join("\n")}`
      : "No files are selected.",
    input.compileSummary ?? "No compile has been run for this session.",
    `User request:\n${input.prompt}`,
  ].join("\n\n");
}
