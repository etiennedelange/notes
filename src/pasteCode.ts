import { EditorView } from "@codemirror/view";

const LANGUAGE_HINTS: Array<[RegExp, string]> = [
  [/^\s*(import|export)\s.+from\s+["']|:\s*(string|number|boolean)\b|interface\s+\w+\s*\{/m, "ts"],
  [/^\s*(function|const|let|var)\s+\w+.*[;{]|=>\s*\{|console\.log\(/m, "js"],
  [/^\s*def\s+\w+\(.*\):|^\s*import\s+\w+|^\s*from\s+\w+\s+import|print\(/m, "python"],
  [/^\s*(public|private|protected)\s+(static\s+)?(class|void|int|String)\b/m, "java"],
  [/^\s*#include\s*<|std::\w+|->\s*\w+\s*\{/m, "cpp"],
  [/^\s*fn\s+\w+\(.*\)\s*(->\s*\w+\s*)?\{|let\s+mut\s+/m, "rust"],
  [/^\s*func\s+\w+\(.*\)\s*\{|package\s+main/m, "go"],
  [/^\s*\.[\w-]+\s*\{|^\s*[\w-]+\s*:\s*[\w#].*;\s*$/m, "css"],
  [/^\s*<\/?[a-z][\w-]*(\s|>|\/>)/im, "html"],
  [/^\s*[{[]\s*$|^\s*"[\w-]+"\s*:\s*/m, "json"],
];

export function guessLanguage(text: string): string {
  for (const [pattern, lang] of LANGUAGE_HINTS) {
    if (pattern.test(text)) return lang;
  }
  return "";
}

/**
 * Heuristic: multi-line pastes are treated as code when they show structural
 * signals (indentation, braces, semicolons, code keywords) rather than prose.
 */
export function looksLikeCode(text: string): boolean {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines.length < 2) return false;
  if (lines.every((line) => line.trim().length === 0)) return false;
  if (/^\s*```/.test(text.trim())) return false;

  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const indentedLines = nonEmptyLines.filter((line) => /^[ \t]/.test(line)).length;
  const bracketLines = nonEmptyLines.filter((line) => /[{};()[\]]/.test(line)).length;
  const codeKeywordLines = nonEmptyLines.filter((line) =>
    /\b(function|const|let|var|def|class|import|export|return|if\s*\(|for\s*\(|while\s*\(|public|private|static|void|fn|package|struct|impl)\b/.test(
      line,
    ),
  ).length;

  const score =
    indentedLines / nonEmptyLines.length +
    bracketLines / nonEmptyLines.length +
    codeKeywordLines / nonEmptyLines.length;

  return score >= 0.6;
}

export function fenceCodeBlock(text: string): string {
  const trimmed = text.replace(/\r\n/g, "\n").replace(/\n+$/, "");
  const lang = guessLanguage(trimmed);
  return `\`\`\`${lang}\n${trimmed}\n\`\`\``;
}

export function codeSnippetPasteHandler(): ReturnType<typeof EditorView.domEventHandlers> {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const text = event.clipboardData?.getData("text/plain");
      if (!text || !looksLikeCode(text)) return false;

      event.preventDefault();
      const fenced = fenceCodeBlock(text);
      view.dispatch(view.state.replaceSelection(fenced));
      return true;
    },
  });
}
