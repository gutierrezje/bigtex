/** Native window / tab title (project name and active file). */
export function formatWindowChromeLabel(
  projectName: string | null,
  filePath: string | null,
): string {
  if (!projectName) return "BigTeX";
  if (!filePath) return projectName;
  return `${projectName} · ${filePath}`;
}
