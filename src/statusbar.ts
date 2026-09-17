import type { App } from "./app";
import { THEMES } from "./themes";
import { isMarkdownPath } from "./editor";
import { escapeHtml } from "./html";
import { computeDocStats } from "./docStats";

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
    updateDocStats(tab.state.doc.toString());
  } else {
    pathEl.textContent = "";
    dirtyEl.classList.add("hidden");
    langEl.textContent = "";
    if (titlebarTitle) titlebarTitle.textContent = "Notes";
    updateCursorLabel(1, 1);
    updateDocStats("");
  }

  switcher.innerHTML = app.themeIds()
    .map((id) => {
      const t = THEMES[id];
      const active = id === app.theme;
      return `
        <button class="theme-swatch ${active ? "active" : ""}" data-theme="${escapeHtml(id)}" title="${escapeHtml(t.label)}" aria-label="${escapeHtml(t.label)} theme" aria-pressed="${active}">
          <span class="swatch-dot" style="background:${escapeHtml(t.accent)}"></span>
          <span class="swatch-bg" style="background:${escapeHtml(t.bg)}; border-color:${escapeHtml(t.border)}"></span>
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
}

export function updateCursorLabel(line: number, col: number) {
  const el = document.getElementById("status-cursor");
  if (el) el.textContent = `Ln ${line}, Col ${col}`;
}

export function updateDocStats(text: string) {
  const el = document.getElementById("status-wordcount");
  if (!el) return;
  if (text === "") {
    el.textContent = "";
    return;
  }
  const { chars, words } = computeDocStats(text);
  el.textContent = `${words} words, ${chars} chars`;
}
