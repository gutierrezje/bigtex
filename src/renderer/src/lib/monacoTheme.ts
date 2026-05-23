import type { Monaco } from "@monaco-editor/react";

/** Keep in sync with `--color-*` in `styles/app.css`. */
export const APP_THEME_COLORS = {
  surface: "#09090b",
  surfaceRaised: "#111113",
  surfaceInset: "#060607",
  border: "#1d1d20",
  borderSubtle: "#141416",
  textPrimary: "#f4f4f6",
  textSecondary: "#96969e",
  textMuted: "#55555c",
  accent: "#3b82f6",
} as const;

export const BIGTEX_MONACO_THEME = "bigtex-dark";

/** Registers the BigTeX editor theme (safe to call on every beforeMount / HMR). */
export function registerBigTexMonacoTheme(monaco: Monaco): void {
  monaco.editor.defineTheme(BIGTEX_MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": APP_THEME_COLORS.surface,
      "editor.foreground": APP_THEME_COLORS.textPrimary,
      "editor.lineHighlightBackground": "#0e0e11",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#3b82f640",
      "editor.inactiveSelectionBackground": "#3b82f624",
      "editorCursor.foreground": APP_THEME_COLORS.textPrimary,
      "editorWhitespace.foreground": APP_THEME_COLORS.borderSubtle,
      "editorIndentGuide.background": APP_THEME_COLORS.borderSubtle,
      "editorIndentGuide.activeBackground": APP_THEME_COLORS.border,
      "editorLineNumber.foreground": APP_THEME_COLORS.textMuted,
      "editorLineNumber.activeForeground": APP_THEME_COLORS.textSecondary,
      "editorGutter.background": APP_THEME_COLORS.surface,
      "editorWidget.background": APP_THEME_COLORS.surfaceRaised,
      "editorWidget.border": APP_THEME_COLORS.border,
      "editorSuggestWidget.background": APP_THEME_COLORS.surfaceRaised,
      "editorSuggestWidget.border": APP_THEME_COLORS.border,
      "editorHoverWidget.background": APP_THEME_COLORS.surfaceRaised,
      "editorHoverWidget.border": APP_THEME_COLORS.border,
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#27272a80",
      "scrollbarSlider.hoverBackground": "#3f3f4680",
      "scrollbarSlider.activeBackground": "#52525b99",
      "minimap.background": APP_THEME_COLORS.surface,
      "panel.background": APP_THEME_COLORS.surfaceRaised,
      "panel.border": APP_THEME_COLORS.border,
    },
  });
}
