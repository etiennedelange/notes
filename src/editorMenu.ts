import { selectAll } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { installContextMenu, type MenuItem } from "./contextMenu";

function selectedText(view: EditorView): string {
  const { state } = view;
  return state.selection.ranges
    .filter((r) => !r.empty)
    .map((r) => state.sliceDoc(r.from, r.to))
    .join(state.lineBreak);
}

/**
 * Pastes through the editor's own paste handling, so a menu paste is the
 * same as Ctrl+V: markdown files still fence a pasted code snippet.
 */
function paste(view: EditorView, text: string) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
  view.contentDOM.dispatchEvent(event);
  if (!event.defaultPrevented) view.dispatch(view.state.replaceSelection(text), { userEvent: "input.paste" });
}

function items(view: EditorView): MenuItem[] {
  const hasSelection = view.state.selection.ranges.some((r) => !r.empty);
  return [
    {
      label: "Cut",
      shortcut: "Ctrl+X",
      enabled: hasSelection,
      run: async () => {
        await writeText(selectedText(view));
        view.dispatch(view.state.replaceSelection(""), { userEvent: "delete.cut" });
      },
    },
    {
      label: "Copy",
      shortcut: "Ctrl+C",
      enabled: hasSelection,
      run: () => writeText(selectedText(view)),
    },
    {
      label: "Paste",
      shortcut: "Ctrl+V",
      enabled: true,
      run: async () => paste(view, await readText()),
    },
    {
      label: "Select All",
      shortcut: "Ctrl+A",
      enabled: true,
      run: () => {
        selectAll(view);
      },
    },
  ];
}

/** The editor's right-click menu. */
export function installEditorMenu(host: HTMLElement, getView: () => EditorView) {
  installContextMenu(host, document.getElementById("editor-menu")!, () => items(getView()));
}
