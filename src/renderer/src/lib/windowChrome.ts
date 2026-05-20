/** Label for the custom title-bar strip (beside macOS traffic lights). */
export function formatWindowChromeLabel(
  projectName: string | null,
  filePath: string | null,
): string {
  if (!projectName) return "BigTeX";
  if (!filePath) return projectName;
  return `${projectName} · ${filePath}`;
}
