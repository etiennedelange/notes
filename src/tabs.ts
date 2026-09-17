import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { App } from "./app";
import { escapeHtml } from "./html";
import { showToast } from "./toast";

let currentApp: App | null = null;
let wired = false;

export function renderTabs(app: App) {
  currentApp = app;
  const strip = document.getElementById("tab-strip")!;

  strip.innerHTML = app.order
    .map((key) => {
      const tab = app.tabs.get(key)!;
      const active = key === app.activeKey;
      const preview = key === app.previewKey;
      const label = app.tabLabel(tab);
      const pinIcon = tab.pinned
        ? `<svg class="icon tab-pin-icon" width="11" height="11" aria-hidden="true"><use href="#icon-pin" /></svg>`
        : "";
      return `
        <div class="tab ${active ? "active" : ""} ${tab.dirty ? "dirty" : ""} ${preview ? "preview" : ""} ${tab.pinned ? "pinned" : ""}" data-tab="${escapeHtml(key)}" role="tab" aria-selected="${active}" title="${escapeHtml(tab.path ?? "Untitled")}">
          ${pinIcon}
          <span class="tab-label">${escapeHtml(label)}</span>
          <span class="dot" aria-hidden="true"></span>
          <button class="tab-close" data-close="${escapeHtml(key)}" title="Close ${tab.dirty ? "(unsaved)" : ""}">
            <svg class="icon" width="11" height="11"><use href="#icon-close" /></svg>
          </button>
        </div>`;
    })
    .join("");

  const activeEl = strip.querySelector(".tab.active");
  activeEl?.scrollIntoView({ block: "nearest", inline: "nearest" });

  wireOnce(strip);
}

async function showTabContextMenu(app: App, key: string) {
  const tab = app.tabs.get(key);
  if (!tab) return;

  const items = await Promise.all([
    MenuItem.new({ text: "Close", action: () => app.closeTab(key) }),
    MenuItem.new({ text: tab.pinned ? "Unpin Tab" : "Pin Tab", action: () => app.togglePinTab(key) }),
    PredefinedMenuItem.new({ item: "Separator" }),
    MenuItem.new({ text: "Close Others", action: () => app.closeOtherTabs(key) }),
    MenuItem.new({ text: "Close All", action: () => app.closeAllTabs() }),
  ]);

  if (tab.path) {
    const path = tab.path;
    items.push(
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        text: "Reveal in File Explorer",
        action: () => revealItemInDir(path).catch((e) => showToast(`Couldn't reveal file: ${e}`, "error")),
      }),
      await MenuItem.new({
        text: "Copy Path",
        action: () => writeText(path).catch((e) => showToast(`Couldn't copy path: ${e}`, "error")),
      }),
    );
  }

  const menu = await Menu.new({ items });
  await menu.popup();
}

function wireOnce(strip: HTMLElement) {
  if (wired) return;
  wired = true;
  strip.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const closeBtn = target.closest<HTMLElement>("[data-close]");
    if (closeBtn) {
      currentApp?.closeTab(closeBtn.dataset.close!);
      return;
    }
    const tabEl = target.closest<HTMLElement>("[data-tab]");
    if (!tabEl) return;
    currentApp?.activateTab(tabEl.dataset.tab!);
    // Click count rather than a dblclick listener: activateTab re-renders this
    // strip's innerHTML, and Chromium skips dblclick when the clicked node is
    // replaced between the two clicks.
    if (e.detail >= 2) currentApp?.promoteTab(tabEl.dataset.tab!);
  });
  strip.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const tabEl = target.closest<HTMLElement>("[data-tab]");
    if (!tabEl || !currentApp) return;
    showTabContextMenu(currentApp, tabEl.dataset.tab!);
  });
  // The browser's default middle-click behavior is to start autoscrolling
  // (the "scrolling cursor"), which swallows the click auxclick would
  // otherwise receive. Suppress it at mousedown so the tab actually closes.
  strip.addEventListener("mousedown", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  strip.addEventListener(
    "auxclick",
    (e) => {
      if (e.button !== 1) return;
      const target = e.target as HTMLElement;
      const tabEl = target.closest<HTMLElement>("[data-tab]");
      if (tabEl) currentApp?.closeTab(tabEl.dataset.tab!);
    },
  );
}
