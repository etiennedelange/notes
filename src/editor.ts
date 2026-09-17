import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { editorTheme, type ThemeTokens } from "./themes";
import { codeSnippetPasteHandler } from "./pasteCode";

export const themeCompartment = new Compartment();
export const languageCompartment = new Compartment();

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

function languageExtension(path: string): Extension {
  return isMarkdownPath(path) ? [markdown(), codeSnippetPasteHandler()] : [];
}

export function createTabEditorState(
  content: string,
  path: string,
  theme: ThemeTokens,
  onDocChanged: () => void,
  onUpdate?: (update: ViewUpdate) => void,
): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      languageCompartment.of(languageExtension(path)),
      themeCompartment.of(editorTheme(theme)),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onDocChanged();
        onUpdate?.(update);
      }),
    ],
  });
}

export function withTheme(state: EditorState, theme: ThemeTokens): EditorState {
  return state.update({
    effects: themeCompartment.reconfigure(editorTheme(theme)),
  }).state;
}
