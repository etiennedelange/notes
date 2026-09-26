import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

const codeBlockLine = Decoration.line({ attributes: { class: "cm-fenced-code-line" } });

function fencedCodeDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const seenLines = new Set<number>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "FencedCode") return;
        const startLine = view.state.doc.lineAt(node.from).number;
        const endLine = view.state.doc.lineAt(node.to).number;
        for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
          seenLines.add(lineNumber);
        }
      },
    });
  }

  for (const lineNumber of [...seenLines].sort((a, b) => a - b)) {
    const line = view.state.doc.line(lineNumber);
    builder.add(line.from, line.from, codeBlockLine);
  }

  return builder.finish();
}

export function codeBlockBackground() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = fencedCodeDecorations(view);
      }

      update(update: ViewUpdate) {
        // A tree change catches the background parser finishing on a large
        // file, which touches neither the document nor the viewport.
        if (update.docChanged || update.viewportChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
          this.decorations = fencedCodeDecorations(update.view);
        }
      }
    },
    {
      decorations: (instance) => instance.decorations,
    },
  );
}
