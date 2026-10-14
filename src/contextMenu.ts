import { escapeHtml } from "./html";
import { showToast } from "./toast";

export interface MenuItem {
  label: string;
  shortcut?: string;
  enabled?: boolean;
  danger?: boolean;
  /** Draws a divider above this item. */
  separator?: boolean;
  run: () => Promise<void> | void;
}

/**
 * An in-app right-click menu: a `popover` rather than the OS menu, so it
 * takes the app's theme (the same call as the in-app unsaved-changes
 * dialog). An auto popover closes itself on Escape or a click elsewhere, and
 * hands focus back to where it came from when it does.
 *
 * `itemsAt` is called on each right-click inside `host` with the event's
 * target, and returns the items to show, or null for no menu (the browser's
 * own menu stays suppressed either way).
 */
export function installContextMenu(
  host: HTMLElement,
  menu: HTMLElement,
  itemsAt: (target: HTMLElement) => MenuItem[] | null,
) {
  let current: MenuItem[] = [];

  const open = (items: MenuItem[], x: number, y: number) => {
    current = items;
    menu.innerHTML = items
      .map(
        (item, i) => `
        ${item.separator ? '<hr class="context-menu-separator" />' : ""}
        <button class="context-menu-item ${item.danger ? "danger" : ""}" role="menuitem" data-index="${i}" ${item.enabled === false ? "disabled" : ""}>
          <span>${escapeHtml(item.label)}</span>${item.shortcut ? `<kbd>${item.shortcut}</kbd>` : ""}
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
    // Read the items now: by the time the button comes up, a re-render may
    // have replaced the element that was clicked.
    const items = itemsAt(e.target as HTMLElement);
    if (!items) return;
    const { clientX: x, clientY: y } = e;
    // Windows fires contextmenu on release, macOS and Linux on press. Opened
    // on press, the release would land outside the menu and light-dismiss
    // it straight away, so wait for the button to come up.
    if (e.buttons & 2) {
      window.addEventListener("pointerup", () => setTimeout(() => open(items, x, y)), { once: true });
    } else {
      open(items, x, y);
    }
  });

  menu.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-index]");
    const item = btn && current[Number(btn.dataset.index)];
    if (!item || item.enabled === false) return;
    menu.hidePopover();
    Promise.resolve(item.run()).catch((err) =>
      showToast(`Couldn't ${item.label.replace(/…$/, "").toLowerCase()}: ${String(err)}`, "error"),
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
