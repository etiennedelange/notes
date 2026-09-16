import type { App } from "./app";
import { fuzzyFilter, type FuzzyMatch } from "./fuzzy";
import { basename, dirname } from "./pathutil";

interface Candidate {
  path: string;
  name: string;
  dir: string;
}

let overlay: HTMLElement;
let input: HTMLInputElement;
let results: HTMLElement;
let currentApp: App | null = null;
let items: Array<{ item: Candidate; match: FuzzyMatch }> = [];
let selected = 0;
let wired = false;

function ensureEls() {
  overlay = document.getElementById("command-palette-overlay")!;
  input = document.getElementById("command-palette-input") as HTMLInputElement;
  results = document.getElementById("command-palette-results")!;
}

export function openCommandPalette(app: App) {
  currentApp = app;
  ensureEls();
  wireOnce();

  const candidates: Candidate[] = app.allKnownPaths().map((path) => ({
    path,
    name: basename(path),
    dir: dirname(path),
  }));

  input.value = "";
  overlay.classList.remove("hidden");
  input.focus();
  runFilter(candidates, "");
}

function closeCommandPalette() {
  overlay.classList.add("hidden");
  currentApp?.view.focus();
}

function runFilter(candidates: Candidate[], query: string) {
  const recentOrder = currentApp?.recentFiles ?? [];
  const filtered = fuzzyFilter(query, candidates, (c) => c.name + " " + c.dir);

  if (query.trim() === "") {
    filtered.sort((a, b) => {
      const ai = recentOrder.indexOf(a.item.path);
      const bi = recentOrder.indexOf(b.item.path);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.item.name.localeCompare(b.item.name);
    });
  }

  items = filtered.slice(0, 100);
  selected = 0;
  renderResults();
}

function highlight(text: string, indices: number[]): string {
  if (indices.length === 0) return escapeHtml(text);
  let out = "";
  let last = 0;
  const set = new Set(indices);
  for (let i = 0; i < text.length; i++) {
    if (set.has(i) && (i === 0 || !set.has(i - 1))) {
      out += escapeHtml(text.slice(last, i));
      let end = i;
      while (set.has(end)) end++;
      out += `<mark>${escapeHtml(text.slice(i, end))}</mark>`;
      last = end;
      i = end - 1;
    }
  }
  out += escapeHtml(text.slice(last));
  return out;
}

function renderResults() {
  if (items.length === 0) {
    results.innerHTML = `<div class="cp-empty">No matching files</div>`;
    return;
  }
  results.innerHTML = items
    .map(({ item, match }, i) => {
      const nameIndices = match.indices.filter((idx) => idx < item.name.length);
      return `
        <div class="cp-item ${i === selected ? "cp-selected" : ""}" data-index="${i}" role="option" aria-selected="${i === selected}">
          <svg class="icon" width="14" height="14"><use href="#icon-file" /></svg>
          <span class="cp-name">${highlight(item.name, nameIndices)}</span>
          <span class="cp-dir">${escapeHtml(item.dir)}</span>
        </div>`;
    })
    .join("");

  results.querySelector(".cp-selected")?.scrollIntoView({ block: "nearest" });
}

function openSelected() {
  const entry = items[selected];
  if (!entry) return;
  currentApp?.openFile(entry.item.path);
  closeCommandPalette();
}

function wireOnce() {
  if (wired) return;
  wired = true;

  input.addEventListener("input", () => {
    const candidates: Candidate[] = (currentApp?.allKnownPaths() ?? []).map((path) => ({
      path,
      name: basename(path),
      dir: dirname(path),
    }));
    runFilter(candidates, input.value);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = Math.min(selected + 1, items.length - 1);
      renderResults();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      renderResults();
    } else if (e.key === "Enter") {
      e.preventDefault();
      openSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette();
    }
  });

  results.addEventListener("click", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!row) return;
    selected = Number(row.dataset.index);
    openSelected();
  });

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeCommandPalette();
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
