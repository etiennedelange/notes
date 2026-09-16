import type { App } from "./app";

let currentApp: App | null = null;
let wired = false;

export function renderTabs(app: App) {
  currentApp = app;
  const strip = document.getElementById("tab-strip")!;

  strip.innerHTML = app.order
    .map((key) => {
      const tab = app.tabs.get(key)!;
      const active = key === app.activeKey;
      const label = app.tabLabel(tab);
      return `
        <div class="tab ${active ? "active" : ""} ${tab.dirty ? "dirty" : ""}" data-tab="${escapeAttr(key)}" role="tab" aria-selected="${active}" title="${escapeAttr(tab.path ?? "Untitled")}">
          <span class="tab-label">${escapeHtml(label)}</span>
          <span class="dot" aria-hidden="true"></span>
          <button class="tab-close" data-close="${escapeAttr(key)}" title="Close ${tab.dirty ? "(unsaved)" : ""}">
            <svg class="icon" width="11" height="11"><use href="#icon-close" /></svg>
          </button>
        </div>`;
    })
    .join("");

  const activeEl = strip.querySelector(".tab.active");
  activeEl?.scrollIntoView({ block: "nearest", inline: "nearest" });

  wireOnce(strip);
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
    if (tabEl) currentApp?.activateTab(tabEl.dataset.tab!);
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

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function escapeAttr(s: string) {
  return escapeHtml(s);
}
