import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

export type ThemeId = "nord" | "tokyo-night" | "noctis-lux" | "noctis-hibernus";

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
  /** `danger` adjusted to read as text on bg/bgElevated (WCAG AA), and as a fill under bg-coloured text. */
  dangerText: string;
  selection: string;
  caret: string;
  /** The close-window button's glyph on its `danger` hover fill: white, or `bg` where `danger` is too light for white. */
  onDangerWindow: string;
}

// Palettes sourced from each project's own published values:
// Nord — nordtheme.com/docs/colors-and-palettes
// Tokyo Night — folke/tokyonight.nvim "storm" variant
// Noctis Lux and Noctis Hibernus — liviuschera/noctis src/workbench/lux.mjs,
// hibernus.mjs + src/colors.mjs
// except the text tiers (fgSubtle, accentText, dangerText), which take the
// personal brand's AA-checked values (personal-context design/brand.md) so
// small text clears 4.5:1 on bg, bgElevated and bgHighlight. Noctis Lux's
// warning is darkened the same way for the "unsaved" status text. Noctis
// Lux's surfaces and borders also have half their upstream chroma (OKLCH,
// same lightness and hue), so the paper reads less yellow; contrast is
// unchanged.
// Hibernus takes upstream's backgrounds, text, accent, caret and selection
// (editor.background, sideBar.background, editor.foreground,
// badge.background, editorCursor.foreground, editor.selectionBackground).
// bgHighlight/border/borderStrong are bgElevated mixed 7/14/24% toward fg,
// fgMuted/fgSubtle are fg mixed 22/42% toward bg, and success/warning/danger
// are its string, constant and tag colours. Text colours are then darkened
// in OKLab lightness, hue kept, until they clear 4.5:1: fgMuted, fgSubtle,
// accentText and dangerText on bg, bgElevated and bgHighlight; success and
// warning on bg and bgElevated. danger clears 3:1 on bgElevated.
// Noctis Lux's dangerText is upstream's #c73c00 darkened the same way (to
// #c23700), which it needed to clear 4.5:1 on bgHighlight.
// onDangerWindow, the close button's hover glyph, is white like Windows'
// own, except on Tokyo Night's light pink danger, where white is 2.65:1
// and bg is 5.5:1. The rest clear 4:1 (3:1 is the bar for an icon).
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
    fgSubtle: "#b2bccd",
    accent: "#88c0d0",
    accentText: "#8fc4d3",
    accentSoft: "rgba(136, 192, 208, 0.16)",
    success: "#a3be8c",
    warning: "#ebcb8b",
    danger: "#bf616a",
    dangerText: "#edaab1",
    selection: "rgba(136, 192, 208, 0.25)",
    caret: "#88c0d0",
    onDangerWindow: "#ffffff",
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
    fgSubtle: "#8c95b6",
    accent: "#7aa2f7",
    accentText: "#7aa2f7",
    accentSoft: "rgba(122, 162, 247, 0.16)",
    success: "#9ece6a",
    warning: "#e0af68",
    danger: "#f7768e",
    dangerText: "#f7768e",
    selection: "rgba(122, 162, 247, 0.25)",
    caret: "#7aa2f7",
    onDangerWindow: "#24283b",
  },
  "noctis-lux": {
    id: "noctis-lux",
    label: "Noctis Lux",
    kind: "light",
    bg: "#fbf8f2",
    bgElevated: "#f5f1e9",
    bgHighlight: "#ede9e0",
    border: "#dfd8c8",
    borderStrong: "#cfc5b2",
    fg: "#00404a",
    fgMuted: "#3f6265",
    fgSubtle: "#576c6d",
    accent: "#0099ad",
    accentText: "#007386",
    accentSoft: "rgba(0, 153, 173, 0.12)",
    success: "#00834f",
    warning: "#996000",
    danger: "#c73c00",
    dangerText: "#c23700",
    selection: "rgba(173, 226, 235, 0.65)",
    caret: "#0092a8",
    onDangerWindow: "#ffffff",
  },
  "noctis-hibernus": {
    id: "noctis-hibernus",
    label: "Noctis Hibernus",
    kind: "light",
    bg: "#f4f6f6",
    bgElevated: "#e7f2f3",
    bgHighlight: "#d7e7e9",
    border: "#c7dcdf",
    borderStrong: "#b0cdd0",
    fg: "#005661",
    fgMuted: "#196169",
    fgSubtle: "#3a6d74",
    accent: "#0099ad",
    accentText: "#007083",
    accentSoft: "rgba(0, 153, 173, 0.12)",
    success: "#007e37",
    warning: "#866a00",
    danger: "#e64100",
    dangerText: "#c81c00",
    selection: "rgba(173, 226, 235, 0.47)",
    caret: "#0092a8",
    onDangerWindow: "#ffffff",
  },
};

export const THEME_ORDER: ThemeId[] = ["nord", "tokyo-night", "noctis-lux", "noctis-hibernus"];

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
  root.style.setProperty("--danger-text", theme.dangerText);
  root.style.setProperty("--selection", theme.selection);
  root.style.setProperty("--caret", theme.caret);
  root.style.setProperty("--on-danger-window", theme.onDangerWindow);
}

function markdownHighlightStyle(theme: ThemeTokens) {
  return HighlightStyle.define([
    // Sized in em so editor zoom scales them; the `#` marks size with the
    // heading. The tight line-height keeps the line box at the body's height,
    // so heading lines don't grow and the gutter's line numbers stay on the
    // text's baseline.
    { tag: t.heading1, color: theme.fg, fontWeight: "700", fontSize: "1.35em", lineHeight: "1.2" },
    { tag: t.heading2, color: theme.fg, fontWeight: "700", fontSize: "1.2em", lineHeight: "1.2" },
    { tag: t.heading3, color: theme.fg, fontWeight: "700", fontSize: "1.08em", lineHeight: "1.2" },
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
        // Must stay translucent: the selection layer paints behind .cm-line
        // (negative z-index), so an opaque active-line background here would
        // fully hide the selection highlight whenever the cursor's line is
        // also the selected line — which is effectively always.
        backgroundColor: `color-mix(in srgb, ${theme.bgHighlight} 55%, transparent)`,
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
