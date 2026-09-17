import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

export type ThemeId = "nord" | "tokyo-night" | "noctis-lux";

export const BASE_EDITOR_FONT_PX = 14.5;

export interface ThemeTokens {
  id: ThemeId;
  label: string;
  kind: "dark" | "light";
  bg: string;
  bgElevated: string;
  bgHighlight: string;
  border: string;
  borderStrong: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  selection: string;
  caret: string;
}

// Palettes sourced from each project's own published values:
// Nord — nordtheme.com/docs/colors-and-palettes
// Tokyo Night — folke/tokyonight.nvim "storm" variant
// Noctis Lux — liviuschera/noctis src/workbench/lux.mjs + src/colors.mjs
export const THEMES: Record<ThemeId, ThemeTokens> = {
  nord: {
    id: "nord",
    label: "Nord",
    kind: "dark",
    bg: "#2e3440",
    bgElevated: "#3b4252",
    bgHighlight: "#434c5e",
    border: "#4c566a",
    borderStrong: "#5e6b84",
    fg: "#eceff4",
    fgMuted: "#d8dee9",
    fgSubtle: "#9aa7bd",
    accent: "#88c0d0",
    accentText: "#88c0d0",
    accentSoft: "rgba(136, 192, 208, 0.16)",
    success: "#a3be8c",
    warning: "#ebcb8b",
    danger: "#bf616a",
    selection: "rgba(136, 192, 208, 0.25)",
    caret: "#88c0d0",
  },
  "tokyo-night": {
    id: "tokyo-night",
    label: "Tokyo Night",
    kind: "dark",
    bg: "#24283b",
    bgElevated: "#1f2335",
    bgHighlight: "#292e42",
    border: "#3b4261",
    borderStrong: "#414868",
    fg: "#c0caf5",
    fgMuted: "#a9b1d6",
    fgSubtle: "#7982a9",
    accent: "#7aa2f7",
    accentText: "#7aa2f7",
    accentSoft: "rgba(122, 162, 247, 0.16)",
    success: "#9ece6a",
    warning: "#e0af68",
    danger: "#f7768e",
    selection: "rgba(122, 162, 247, 0.25)",
    caret: "#7aa2f7",
  },
  "noctis-lux": {
    id: "noctis-lux",
    label: "Noctis Lux",
    kind: "light",
    bg: "#fef8ec",
    bgElevated: "#f9f1e1",
    bgHighlight: "#f0e9d6",
    border: "#e6d7b8",
    borderStrong: "#d8c49c",
    fg: "#00404a",
    fgMuted: "#3f6265",
    fgSubtle: "#6d8788",
    accent: "#0099ad",
    accentText: "#00778a",
    accentSoft: "rgba(0, 153, 173, 0.12)",
    success: "#00834f",
    warning: "#a86a00",
    danger: "#c73c00",
    selection: "rgba(173, 226, 235, 0.65)",
    caret: "#0092a8",
  },
};

export const THEME_ORDER: ThemeId[] = ["nord", "tokyo-night", "noctis-lux"];

export function applyChromeTheme(theme: ThemeTokens) {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.dataset.themeKind = theme.kind;
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--bg-elevated", theme.bgElevated);
  root.style.setProperty("--bg-highlight", theme.bgHighlight);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--border-strong", theme.borderStrong);
  root.style.setProperty("--fg", theme.fg);
  root.style.setProperty("--fg-muted", theme.fgMuted);
  root.style.setProperty("--fg-subtle", theme.fgSubtle);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-text", theme.accentText);
  root.style.setProperty("--accent-soft", theme.accentSoft);
  root.style.setProperty("--success", theme.success);
  root.style.setProperty("--warning", theme.warning);
  root.style.setProperty("--danger", theme.danger);
  root.style.setProperty("--selection", theme.selection);
  root.style.setProperty("--caret", theme.caret);
}

function markdownHighlightStyle(theme: ThemeTokens) {
  return HighlightStyle.define([
    { tag: [t.heading1, t.heading2, t.heading3], color: theme.fg, fontWeight: "700" },
    { tag: [t.heading4, t.heading5, t.heading6], color: theme.fg, fontWeight: "600" },
    { tag: t.strong, color: theme.fg, fontWeight: "700" },
    { tag: t.emphasis, color: theme.fg, fontStyle: "italic" },
    { tag: t.strikethrough, color: theme.fgSubtle, textDecoration: "line-through" },
    { tag: t.link, color: theme.accentText, textDecoration: "underline" },
    { tag: t.url, color: theme.fgSubtle },
    { tag: t.monospace, color: theme.success, fontFamily: "var(--font-mono)" },
    { tag: t.quote, color: theme.fgMuted, fontStyle: "italic" },
    { tag: t.contentSeparator, color: theme.accent },
    { tag: t.processingInstruction, color: theme.fgSubtle },
    { tag: t.meta, color: theme.fgSubtle },
    { tag: t.comment, color: theme.fgSubtle, fontStyle: "italic" },
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: theme.accent, fontWeight: "600" },
    { tag: [t.string, t.special(t.string)], color: theme.success },
    { tag: [t.number, t.bool, t.null], color: theme.warning },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: theme.accentText },
    { tag: [t.className, t.typeName], color: theme.danger },
    { tag: t.propertyName, color: theme.accent },
    { tag: t.operator, color: theme.fgMuted },
    { tag: t.definition(t.variableName), color: theme.fg },
    { tag: t.angleBracket, color: theme.fgSubtle },
    { tag: t.tagName, color: theme.accent },
    { tag: t.attributeName, color: theme.warning },
  ]);
}

export function editorTheme(theme: ThemeTokens): Extension {
  const view = EditorView.theme(
    {
      "&": {
        color: theme.fg,
        backgroundColor: theme.bg,
        height: "100%",
        fontSize: "var(--editor-font-size, 14.5px)",
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-content": {
        caretColor: theme.caret,
        fontFamily: "var(--font-mono)",
        padding: "20px 0",
      },
      ".cm-scroller": {
        lineHeight: "1.65",
        overflow: "auto",
        overscrollBehavior: "contain",
      },
      "&.cm-focused .cm-cursor": {
        borderLeftColor: theme.caret,
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: theme.selection + " !important",
      },
      ".cm-activeLine": {
        backgroundColor: theme.bgHighlight,
      },
      ".cm-activeLineGutter": {
        backgroundColor: theme.bgHighlight,
        color: theme.fg,
      },
      ".cm-gutters": {
        backgroundColor: theme.bg,
        color: theme.fgSubtle,
        border: "none",
        paddingRight: "8px",
      },
      ".cm-lineNumbers .cm-gutterElement": {
        padding: "0 10px 0 20px",
      },
      ".cm-matchingBracket, .cm-nonmatchingBracket": {
        backgroundColor: theme.accentSoft,
        outline: `1px solid ${theme.accent}`,
      },
      ".cm-foldPlaceholder": {
        backgroundColor: theme.bgHighlight,
        border: `1px solid ${theme.border}`,
        color: theme.fgMuted,
      },
      ".cm-fenced-code-line": {
        backgroundColor: theme.bgElevated,
      },
      ".cm-tooltip": {
        backgroundColor: theme.bgElevated,
        border: `1px solid ${theme.border}`,
        color: theme.fg,
      },
      ".cm-panels": {
        backgroundColor: theme.bgElevated,
        color: theme.fg,
      },
    },
    { dark: theme.kind === "dark" },
  );
  return [view, syntaxHighlighting(markdownHighlightStyle(theme))];
}
