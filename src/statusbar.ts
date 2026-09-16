import type { App } from "./app";
import { THEMES } from "./themes";
import { isMarkdownPath } from "./editor";

let currentApp: App | null = null;
let wired = false;

export function renderStatusBar(app: App) {
  currentApp = app;
  const pathEl = document.getElementById("status-path")!;
  const dirtyEl = document.getElementById("status-dirty")!;
  const langEl = document.getElementById("status-lang")!;
  const switcher = document.getElementById("theme-switcher")!;

  const tab = app.activeKey ? app.tabs.get(app.activeKey) : null;
  const titlebarTitle = document.getElementById("titlebar-title-text");
  if (tab) {
    const label = app.tabLabel(tab);
    pathEl.textContent = tab.isUntitled ? "Untitled" : tab.path!;
    dirtyEl.classList.toggle("hidden", !tab.dirty);
    langEl.textContent = tab.isUntitled
      ? "Plain Text"
      : isMarkdownPath(tab.path!)
        ? "Markdown"
        : "Plain Text";
    if (titlebarTitle) titlebarTitle.textContent = `${tab.dirty ? "● " : ""}${label} — Notes`;

    const pos = tab.state.selection.main.head;
    const line = tab.state.doc.lineAt(pos);
    updateCursorLabel(line.number, pos - line.from + 1);
  } else {
    pathEl.textContent = "";
    dirtyEl.classList.add("hidden");
    langEl.textContent = "";
    if (titlebarTitle) titlebarTitle.textContent = "Notes";
    updateCursorLabel(1, 1);
  }

  switcher.innerHTML = app.themeIds()
    .map((id) => {
      const t = THEMES[id];
      const active = id === app.theme;
      return `
        <button class="theme-swatch ${active ? "active" : ""}" data-theme="${id}" title="${t.label}" aria-label="${t.label} theme" aria-pressed="${active}">
          <span class="swatch-dot" style="background:${t.accent}"></span>
          <span class="swatch-bg" style="background:${t.bg}; border-color:${t.border}"></span>
        </button>`;
    })
    .join("");

  if (!wired) {
    wired = true;
    switcher.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-theme]");
      if (btn) currentApp?.setTheme(btn.dataset.theme as any);
    });
  }

  updateCursorLabel(1, 1);
}

export function updateCursorLabel(line: number, col: number) {
  const el = document.getElementById("status-cursor");
  if (el) el.textContent = `Ln ${line}, Col ${col}`;
}
