import { EditorState, Compartment, type Extension } from "@codemirror/state";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { editorTheme, type ThemeTokens } from "./themes";
import { codeSnippetPasteHandler } from "./pasteCode";
import { codeBlockBackground } from "./codeBlockBackground";

export const themeCompartment = new Compartment();
export const languageCompartment = new Compartment();

export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

function languageExtension(path: string): Extension {
  return isMarkdownPath(path)
    ? [markdown({ codeLanguages: languages }), codeSnippetPasteHandler(), codeBlockBackground()]
    : [];
}

export function createTabEditorState(
  content: string,
  path: string,
  theme: ThemeTokens,
  onDocChanged: (update: ViewUpdate) => void,
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
        // onUpdate first: it's where the app records the new state, and
        // onDocChanged re-renders from it.
        onUpdate?.(update);
        if (update.docChanged) onDocChanged(update);
      }),
    ],
  });
}

/** Switches a state's language to match `path`, e.g. after Save As or a rename changes its extension. */
export function withLanguage(state: EditorState, path: string): EditorState {
  return state.update({
    effects: languageCompartment.reconfigure(languageExtension(path)),
  }).state;
}

export function withTheme(state: EditorState, theme: ThemeTokens): EditorState {
  return state.update({
    effects: themeCompartment.reconfigure(editorTheme(theme)),
  }).state;
}
