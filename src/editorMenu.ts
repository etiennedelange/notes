import { selectAll } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { showToast } from "./toast";

interface MenuItem {
  label: string;
  shortcut: string;
  enabled: boolean;
  run: () => Promise<void> | void;
}

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

/**
 * The editor's right-click menu: an in-app `popover` rather than the OS menu,
 * so it takes the app's theme (the same call as the in-app unsaved-changes
 * dialog). An auto popover closes itself on Escape or a click elsewhere, and
 * hands focus back to the editor when it does.
 */
export function installEditorMenu(host: HTMLElement, getView: () => EditorView) {
  const menu = document.getElementById("editor-menu")!;
  let current: MenuItem[] = [];

  const open = (x: number, y: number) => {
    const view = getView();
    current = items(view);
    menu.innerHTML = current
      .map(
        (item, i) => `
        <button class="context-menu-item" role="menuitem" data-index="${i}" ${item.enabled ? "" : "disabled"}>
          <span>${item.label}</span><kbd>${item.shortcut}</kbd>
        </button>`,
      )
      .join("");

    menu.showPopover();
    // Open at the pointer, but flip inwards rather than run off the window.
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - height - 4))}px`;
    // Focus the menu, not its first item, so nothing is highlighted until
    // the arrow keys pick one, as in a native menu.
    menu.focus();
  };

  host.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const { clientX: x, clientY: y } = e;
    // Windows fires contextmenu on release, macOS and Linux on press. Opened
    // on press, the release would land outside the menu and light-dismiss
    // it straight away, so wait for the button to come up.
    if (e.buttons & 2) {
      window.addEventListener("pointerup", () => setTimeout(() => open(x, y)), { once: true });
    } else {
      open(x, y);
    }
  });

  menu.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-index]");
    const item = btn && current[Number(btn.dataset.index)];
    if (!item?.enabled) return;
    menu.hidePopover();
    Promise.resolve(item.run()).catch((err) =>
      showToast(`Couldn't ${item.label.toLowerCase()}: ${String(err)}`, "error"),
    );
  });

  menu.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = Array.from(menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? idx + 1 : idx === -1 ? buttons.length - 1 : idx - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
  });
}
