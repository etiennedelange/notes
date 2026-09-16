import type { App } from "./app";
import type { DirNode } from "./fs";
import { escapeHtml } from "./html";
import { basename } from "./pathutil";

function iconFor(isDir: boolean, expanded: boolean): string {
  if (!isDir) return "#icon-file";
  return expanded ? "#icon-folder-open" : "#icon-folder";
}

function renderNode(app: App, node: DirNode, depth: number): string {
  if (node.isDir) {
    const expanded = app.expandedDirs.has(node.path);
    const children = node.children ?? [];
    return `
      <div class="tree-node">
        <button class="tree-row tree-row-dir" data-dir="${escapeHtml(node.path)}" style="--depth:${depth}">
          <svg class="chevron ${expanded ? "chevron-open" : ""}" width="12" height="12"><use href="#icon-chevron" /></svg>
          <svg class="icon" width="14" height="14"><use href="${iconFor(true, expanded)}" /></svg>
          <span class="tree-label">${escapeHtml(node.name)}</span>
        </button>
        ${expanded ? `<div class="tree-children">${children.map((c) => renderNode(app, c, depth + 1)).join("")}</div>` : ""}
      </div>`;
  }
  const active = app.activeKey === node.path;
  const dirty = app.tabs.get(node.path)?.dirty;
  return `
    <button class="tree-row tree-row-file ${active ? "active" : ""}" data-file="${escapeHtml(node.path)}" style="--depth:${depth}" title="${escapeHtml(node.path)}">
      <svg class="icon" width="14" height="14"><use href="${iconFor(false, false)}" /></svg>
      <span class="tree-label">${escapeHtml(node.name)}</span>
      ${dirty ? '<span class="dot" aria-hidden="true"></span>' : ""}
    </button>`;
}

export function renderSidebar(app: App) {
  currentApp = app;
  const treeEl = document.getElementById("folder-tree")!;
  const looseEl = document.getElementById("loose-files")!;
  const label = document.getElementById("folder-label")!;
  const closeBtn = document.getElementById("close-folder-btn")!;
  const looseSection = document.getElementById("loose-files-section")!;

  if (app.openFolder && app.tree) {
    label.textContent = basename(app.openFolder);
    closeBtn.classList.remove("hidden");
    const rows = (app.tree.children ?? []).map((c) => renderNode(app, c, 0)).join("");
    treeEl.innerHTML = rows || `<p class="tree-empty">No .txt or .md files here</p>`;
    if (app.tree.truncated) {
      treeEl.innerHTML += `<p class="tree-empty">Folder is too large to show fully — some files are hidden.</p>`;
    }
  } else {
    label.textContent = "Open Folder";
    closeBtn.classList.add("hidden");
    treeEl.innerHTML = `<p class="tree-empty">Point Notes at a folder to browse it. Nothing is imported or indexed — it's just a view.</p>`;
  }

  if (app.looseFiles.length === 0) {
    looseSection.classList.add("hidden");
  } else {
    looseSection.classList.remove("hidden");
    looseEl.innerHTML = app.looseFiles
      .map((path) => {
        const active = app.activeKey === path;
        const dirty = app.tabs.get(path)?.dirty;
        return `
          <div class="tree-row tree-row-file loose-row ${active ? "active" : ""}" style="--depth:0">
            <button class="loose-open" data-file="${escapeHtml(path)}" title="${escapeHtml(path)}">
              <svg class="icon" width="14" height="14"><use href="#icon-file" /></svg>
              <span class="tree-label">${escapeHtml(basename(path))}</span>
              ${dirty ? '<span class="dot" aria-hidden="true"></span>' : ""}
            </button>
            <button class="unpin-btn" data-unpin="${escapeHtml(path)}" title="Remove from list">
              <svg class="icon" width="11" height="11"><use href="#icon-close" /></svg>
            </button>
          </div>`;
      })
      .join("");
  }

  wireOnce();
}

let wired = false;
function wireOnce() {
  if (wired) return;
  wired = true;
  document.getElementById("open-folder-btn")!.addEventListener("click", () => currentApp?.openFolderDialog());
  document.getElementById("close-folder-btn")!.addEventListener("click", () => currentApp?.closeFolder());

  document.getElementById("folder-tree")!.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const dirBtn = target.closest<HTMLElement>("[data-dir]");
    const fileBtn = target.closest<HTMLElement>("[data-file]");
    if (dirBtn) currentApp?.toggleDir(dirBtn.dataset.dir!);
    else if (fileBtn) currentApp?.openFile(fileBtn.dataset.file!, { preview: true });
  });
  document.getElementById("folder-tree")!.addEventListener("dblclick", (e) => {
    const target = e.target as HTMLElement;
    const fileBtn = target.closest<HTMLElement>("[data-file]");
    if (fileBtn) currentApp?.pinTab(fileBtn.dataset.file!);
  });

  document.getElementById("loose-files")!.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const unpin = target.closest<HTMLElement>("[data-unpin]");
    const fileBtn = target.closest<HTMLElement>("[data-file]");
    if (unpin) currentApp?.closeLooseFile(unpin.dataset.unpin!);
    else if (fileBtn) currentApp?.openFile(fileBtn.dataset.file!, { preview: true });
  });
  document.getElementById("loose-files")!.addEventListener("dblclick", (e) => {
    const target = e.target as HTMLElement;
    const fileBtn = target.closest<HTMLElement>("[data-file]");
    if (fileBtn) currentApp?.pinTab(fileBtn.dataset.file!);
  });
}

let currentApp: App | null = null;
