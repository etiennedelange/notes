import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// Ordered by how distinctive a language's syntax is: languages with signals
// that only they use (e.g. C#'s nullable `Type? name = null`) are checked
// with narrower patterns than catch-all C-style languages like JS, whose
// `var`/`const` + semicolon shape also matches C#, Java, etc. Detection is
// scored (see guessLanguage) rather than first-match, so the most-matched
// language wins even when a looser pattern (like JS's) also fires.
const LANGUAGE_PATTERNS: Array<{ lang: string; patterns: RegExp[] }> = [
  {
    lang: "csharp",
    patterns: [
      /\bnamespace\s+[\w.]+/,
      /\busing\s+System\b/,
      /\w+\?\s+\w+\s*=\s*null\b/,
      /\bnew\s+[A-Z]\w*\s*\r?\n\s*\{/,
      /\bpublic\s+(class|interface|struct|enum|readonly)\b/,
      /\bGuard\.\w+\(/,
      /\bFunc<[^>]+>/,
      /\bTask<[^>]*>/,
      /\?\?=/,
      /\bvar\s+\w+\s*=\s*new\s+[A-Z]\w*/,
    ],
  },
  {
    lang: "ts",
    patterns: [
      /^\s*(import|export)\s.+from\s+["']/m,
      /:\s*(string|number|boolean)\b/,
      /interface\s+\w+\s*\{/,
    ],
  },
  {
    lang: "java",
    patterns: [
      /\bpublic\s+static\s+void\s+main\b/,
      /\bSystem\.out\.println\(/,
      /^\s*import\s+java\./m,
      /\b(public|private|protected)\s+(static\s+)?(class|void|int|String)\b/,
    ],
  },
  {
    lang: "python",
    patterns: [
      /^\s*def\s+\w+\(.*\):/m,
      /^\s*import\s+\w+/m,
      /^\s*from\s+\w+\s+import/m,
      /\bprint\(/,
    ],
  },
  {
    lang: "cpp",
    patterns: [/^\s*#include\s*</m, /\bstd::\w+/, /->\s*\w+\s*\{/],
  },
  {
    lang: "rust",
    patterns: [/^\s*fn\s+\w+\(/m, /\blet\s+mut\s+/, /->\s*\w+\s*\{/],
  },
  {
    lang: "go",
    patterns: [/^\s*func\s+\w+\(/m, /\bpackage\s+main\b/],
  },
  {
    lang: "css",
    patterns: [/^\s*\.[\w-]+\s*\{/m, /^\s*[\w-]+\s*:\s*[\w#].*;\s*$/m],
  },
  {
    lang: "html",
    patterns: [/^\s*<\/?[a-z][\w-]*(\s|>|\/>)/im],
  },
  {
    lang: "json",
    patterns: [/^\s*[{[]\s*$/m, /^\s*"[\w-]+"\s*:\s*/m],
  },
  {
    lang: "js",
    patterns: [
      /\bconsole\.log\(/,
      /\brequire\(/,
      /\bmodule\.exports\b/,
      /=>\s*\{/,
      /^\s*(function|const|let|var)\s+\w+.*[;{]/m,
    ],
  },
];

export function guessLanguage(text: string): string {
  let best = "";
  let bestScore = 0;
  for (const { lang, patterns } of LANGUAGE_PATTERNS) {
    const score = patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
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

/** True if `pos` sits inside a fenced code block, where a paste is already code. */
export function insideFencedCode(state: EditorState, pos: number): boolean {
  let node = syntaxTree(state).resolveInner(pos, -1);
  for (;;) {
    if (node.name === "FencedCode") return true;
    if (!node.parent) return false;
    node = node.parent;
  }
}

export function codeSnippetPasteHandler(): ReturnType<typeof EditorView.domEventHandlers> {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const text = event.clipboardData?.getData("text/plain");
      if (!text || !looksLikeCode(text)) return false;
      if (insideFencedCode(view.state, view.state.selection.main.from)) return false;

      event.preventDefault();
      const fenced = fenceCodeBlock(text);
      view.dispatch(view.state.replaceSelection(fenced));
      return true;
    },
  });
}
