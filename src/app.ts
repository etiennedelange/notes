import { EditorView, type ViewUpdate } from "@codemirror/view";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  readDirTree,
  readTextFile,
  writeTextFile,
  pathExists,
  fileMtimeMs,
  loadState,
  saveState,
  type DirNode,
} from "./fs";
import { createTabEditorState, withTheme } from "./editor";
import { THEMES, THEME_ORDER, applyChromeTheme, type ThemeId } from "./themes";
import { basename, isDescendant } from "./pathutil";
import { showToast } from "./toast";
import type { Tab } from "./types";
import { renderSidebar } from "./sidebar";
import { renderTabs } from "./tabs";
import { renderStatusBar, updateCursorLabel } from "./statusbar";
import { openCommandPalette } from "./commandPalette";
import { unsavedChangesModal, showModal } from "./modal";

const RECENT_LIMIT = 30;
const NOTE_EXT = /\.(txt|md|markdown)$/i;

export class App {
  tabs = new Map<string, Tab>();
  order: string[] = [];
  activeKey: string | null = null;
  openFolder: string | null = null;
  tree: DirNode | null = null;
  looseFiles: string[] = [];
  recentFiles: string[] = [];
  theme: ThemeId = "nord";
  expandedDirs = new Set<string>();
  untitledCounter = 1;

  view: EditorView;

  constructor(private editorHost: HTMLElement) {
    this.view = new EditorView({
      parent: editorHost,
      state: createTabEditorState("", "__init__.txt", THEMES[this.theme], () => {}),
    });
  }

  private handleCursorUpdate = (update: ViewUpdate) => {
    if (!update.docChanged && !update.selectionSet) return;
    const pos = update.state.selection.main.head;
    const line = update.state.doc.lineAt(pos);
    updateCursorLabel(line.number, pos - line.from + 1);
  };

  // ---------- boot ----------

  async init() {
    const persisted = await loadState().catch(() => null);
    if (persisted?.theme && persisted.theme in THEMES) {
      this.theme = persisted.theme as ThemeId;
    }
    applyChromeTheme(THEMES[this.theme]);

    if (persisted?.recentFiles) this.recentFiles = persisted.recentFiles;

    if (persisted?.lastFolder && (await pathExists(persisted.lastFolder))) {
      await this.setOpenFolder(persisted.lastFolder, { skipPersist: true });
    }

    if (persisted?.openTabs?.length) {
      for (const path of persisted.openTabs) {
        if (await pathExists(path)) {
          await this.openFile(path, { activate: false, skipPersist: true, skipRecent: true });
        }
      }
    }

    if (persisted?.activeTab && this.tabs.has(persisted.activeTab)) {
      this.activateTab(persisted.activeTab);
    } else if (this.order.length > 0) {
      this.activateTab(this.order[0]);
    }

    this.renderAll();
    this.wireGlobalShortcuts();
    this.wireWindowClose();
    this.wireDragDrop();
  }

  private renderAll() {
    renderSidebar(this);
    renderTabs(this);
    renderStatusBar(this);
    this.updateEmptyState();
  }

  private updateEmptyState() {
    const empty = document.getElementById("empty-state")!;
    const host = this.editorHost;
    if (this.activeKey) {
      empty.classList.add("hidden");
      host.classList.remove("hidden");
    } else {
      empty.classList.remove("hidden");
      host.classList.add("hidden");
    }
  }

  private persist() {
    const openTabs = this.order.filter((k) => !this.tabs.get(k)!.isUntitled).map((k) => this.tabs.get(k)!.path!);
    saveState({
      theme: this.theme,
      lastFolder: this.openFolder ?? undefined,
      recentFiles: this.recentFiles,
      openTabs,
      activeTab: this.activeKey && !this.tabs.get(this.activeKey)?.isUntitled ? this.activeKey : undefined,
    }).catch(() => {});
  }

  // ---------- folder ----------

  async openFolderDialog() {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === "string") await this.setOpenFolder(picked);
  }

  async setOpenFolder(path: string, opts: { skipPersist?: boolean } = {}) {
    try {
      this.tree = await readDirTree(path);
      this.openFolder = path;
      this.expandedDirs = new Set([path]);
    } catch (e) {
      showToast(`Couldn't open folder: ${e}`, "error");
      return;
    }
    if (!opts.skipPersist) this.persist();
    renderSidebar(this);
  }

  closeFolder() {
    this.openFolder = null;
    this.tree = null;
    this.persist();
    renderSidebar(this);
  }

  toggleDir(path: string) {
    if (this.expandedDirs.has(path)) this.expandedDirs.delete(path);
    else this.expandedDirs.add(path);
    renderSidebar(this);
  }

  // ---------- files / tabs ----------

  async openFileDialog() {
    const picked = await openDialog({
      multiple: false,
      filters: [{ name: "Notes", extensions: ["txt", "md", "markdown"] }],
    });
    if (typeof picked === "string") await this.openFile(picked);
  }

  async openFile(
    path: string,
    opts: { activate?: boolean; skipPersist?: boolean; skipRecent?: boolean } = {},
  ) {
    const activate = opts.activate ?? true;
    if (this.tabs.has(path)) {
      if (activate) this.activateTab(path);
      return;
    }
    let content: string;
    try {
      content = await readTextFile(path);
    } catch (e) {
      showToast(`Couldn't open ${basename(path)}: ${e}`, "error");
      return;
    }
    const mtime = await fileMtimeMs(path).catch(() => null);
    const state = createTabEditorState(
      content,
      path,
      THEMES[this.theme],
      () => this.markDirty(path),
      this.handleCursorUpdate,
    );

    const tab: Tab = { key: path, path, isUntitled: false, state, dirty: false, diskMtime: mtime };
    this.tabs.set(path, tab);
    this.order.push(path);

    if (!this.openFolder || !isDescendant(this.openFolder, path)) {
      if (!this.looseFiles.includes(path)) this.looseFiles.push(path);
    }
    if (!opts.skipRecent) this.touchRecent(path);

    if (activate) this.activateTab(path);
    else {
      renderTabs(this);
      renderSidebar(this);
    }
    if (!opts.skipPersist) this.persist();
  }

  newUntitledTab() {
    const key = `untitled:${this.untitledCounter++}`;
    const state = createTabEditorState(
      "",
      "untitled.md",
      THEMES[this.theme],
      () => this.markDirty(key),
      this.handleCursorUpdate,
    );
    const tab: Tab = { key, path: null, isUntitled: true, state, dirty: false, diskMtime: null };
    this.tabs.set(key, tab);
    this.order.push(key);
    this.activateTab(key);
  }

  activateTab(key: string) {
    const tab = this.tabs.get(key);
    if (!tab) return;
    if (this.activeKey && this.activeKey !== key) this.captureActiveDoc();
    this.activeKey = key;
    this.view.setState(tab.state);
    this.view.focus();
    renderTabs(this);
    renderSidebar(this);
    renderStatusBar(this);
    const pos = tab.state.selection.main.head;
    const line = tab.state.doc.lineAt(pos);
    updateCursorLabel(line.number, pos - line.from + 1);
    this.updateEmptyState();
    this.persist();
  }

  async closeTab(key: string) {
    const tab = this.tabs.get(key);
    if (!tab) return;
    if (tab.dirty) {
      const choice = await unsavedChangesModal({
        title: "Unsaved changes",
        message: `"${this.tabLabel(tab)}" has unsaved changes. Do you want to save them before closing?`,
      });
      if (choice === "cancel") return;
      if (choice === "save") {
        const saved = await this.saveTab(key);
        if (!saved) return;
        key = saved.key;
      }
    }
    this.tabs.delete(key);
    this.order = this.order.filter((k) => k !== key);
    if (this.activeKey === key) {
      const next = this.order[this.order.length - 1] ?? null;
      this.activeKey = null;
      if (next) this.activateTab(next);
      else {
        this.view.setState(createTabEditorState("", "__init__.txt", THEMES[this.theme], () => {}));
        renderTabs(this);
        renderStatusBar(this);
        this.updateEmptyState();
      }
    } else {
      renderTabs(this);
    }
    this.persist();
  }

  cycleTab(direction: 1 | -1) {
    if (this.order.length < 2 || !this.activeKey) return;
    const idx = this.order.indexOf(this.activeKey);
    const next = this.order[(idx + direction + this.order.length) % this.order.length];
    this.activateTab(next);
  }

  private captureActiveDoc() {
    if (!this.activeKey) return;
    const tab = this.tabs.get(this.activeKey);
    if (!tab) return;
    tab.state = this.view.state;
  }

  markDirty(key: string) {
    const tab = this.tabs.get(key);
    if (!tab || tab.dirty) return;
    tab.dirty = true;
    renderTabs(this);
  }

  tabLabel(tab: Tab): string {
    if (tab.isUntitled) return "Untitled";
    return basename(tab.path!);
  }

  async saveActiveTab() {
    if (!this.activeKey) return;
    await this.saveTab(this.activeKey);
  }

  /** Saves a tab (prompting Save As for untitled tabs). Returns the saved Tab on success, null if cancelled/failed. */
  async saveTab(key: string): Promise<Tab | null> {
    if (key === this.activeKey) this.captureActiveDoc();
    const tab = this.tabs.get(key);
    if (!tab) return null;
    if (tab.isUntitled) return this.saveTabAs(key);
    const ok = await this.writeTab(tab);
    return ok ? tab : null;
  }

  private async saveTabAs(key: string): Promise<Tab | null> {
    const tab = this.tabs.get(key);
    if (!tab) return null;
    const picked = await saveDialog({
      filters: [{ name: "Markdown", extensions: ["md"] }, { name: "Text", extensions: ["txt"] }],
      defaultPath: tab.isUntitled ? "Untitled.md" : tab.path!,
    });
    if (!picked) return null;
    // Not every platform's save dialog appends the filter's extension (GTK
    // notably doesn't), and the backend refuses to write non-note files.
    const target = NOTE_EXT.test(picked) ? picked : `${picked}.md`;

    if (tab.isUntitled) {
      this.tabs.delete(key);
      this.order = this.order.map((k) => (k === key ? target : k));
      tab.key = target;
      tab.path = target;
      tab.isUntitled = false;
      this.tabs.set(target, tab);
      if (this.activeKey === key) this.activeKey = target;
      if (!this.openFolder || !isDescendant(this.openFolder, target)) this.looseFiles.push(target);
      this.touchRecent(target);
    } else {
      tab.path = target;
      tab.key = target;
    }
    const ok = await this.writeTab(tab);
    renderTabs(this);
    renderSidebar(this);
    return ok ? tab : null;
  }

  private async writeTab(tab: Tab): Promise<boolean> {
    if (tab.diskMtime != null && (await pathExists(tab.path!).catch(() => false))) {
      const currentMtime = await fileMtimeMs(tab.path!).catch(() => tab.diskMtime);
      if (currentMtime !== tab.diskMtime) {
        const choice = await showModal({
          title: "File changed on disk",
          message: `"${basename(tab.path!)}" was modified outside Notes since you opened it. Overwrite the newer version on disk, or reload it and lose your changes here?`,
          danger: true,
          buttons: [
            { id: "cancel", label: "Cancel", variant: "ghost" },
            { id: "reload", label: "Reload from Disk", variant: "ghost", danger: true },
            { id: "overwrite", label: "Overwrite", autofocus: true },
          ],
        });
        if (choice === "reload") {
          await this.reloadTabFromDisk(tab);
          return true;
        }
        if (choice !== "overwrite") return false;
      }
    }

    try {
      await writeTextFile(tab.path!, tab.state.doc.toString());
      tab.dirty = false;
      tab.diskMtime = await fileMtimeMs(tab.path!).catch(() => Date.now());
      renderTabs(this);
      renderStatusBar(this);
      this.persist();
      showToast(`Saved ${basename(tab.path!)}`);
      return true;
    } catch (e) {
      showToast(`Couldn't save: ${e}`, "error");
      return false;
    }
  }

  private async reloadTabFromDisk(tab: Tab) {
    try {
      const content = await readTextFile(tab.path!);
      const mtime = await fileMtimeMs(tab.path!).catch(() => Date.now());
      tab.state = createTabEditorState(content, tab.path!, THEMES[this.theme], () => this.markDirty(tab.key), this.handleCursorUpdate);
      tab.dirty = false;
      tab.diskMtime = mtime;
      if (this.activeKey === tab.key) this.view.setState(tab.state);
      renderTabs(this);
      renderStatusBar(this);
      showToast(`Reloaded ${basename(tab.path!)} from disk`);
    } catch (e) {
      showToast(`Couldn't reload: ${e}`, "error");
    }
  }

  closeLooseFile(path: string) {
    this.looseFiles = this.looseFiles.filter((p) => p !== path);
    renderSidebar(this);
  }

  private touchRecent(path: string) {
    this.recentFiles = [path, ...this.recentFiles.filter((p) => p !== path)].slice(0, RECENT_LIMIT);
  }

  allKnownPaths(): string[] {
    const set = new Set<string>();
    const walk = (node: DirNode) => {
      if (!node.isDir) set.add(node.path);
      node.children?.forEach(walk);
    };
    if (this.tree) walk(this.tree);
    this.looseFiles.forEach((p) => set.add(p));
    this.recentFiles.forEach((p) => set.add(p));
    return Array.from(set);
  }

  // ---------- theme ----------

  setTheme(id: ThemeId) {
    if (id === this.theme) return;
    this.theme = id;
    const tokens = THEMES[id];
    applyChromeTheme(tokens);
    this.captureActiveDoc();
    for (const tab of this.tabs.values()) {
      tab.state = withTheme(tab.state, tokens);
    }
    if (this.activeKey) this.view.setState(this.tabs.get(this.activeKey)!.state);
    renderStatusBar(this);
    this.persist();
  }

  // ---------- shortcuts / lifecycle ----------

  private wireGlobalShortcuts() {
    window.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === "p" && !e.shiftKey) {
        e.preventDefault();
        openCommandPalette(this);
      } else if (key === "s") {
        e.preventDefault();
        this.saveActiveTab();
      } else if (key === "o" && e.shiftKey) {
        e.preventDefault();
        this.openFolderDialog();
      } else if (key === "o") {
        e.preventDefault();
        this.openFileDialog();
      } else if (key === "n") {
        e.preventDefault();
        this.newUntitledTab();
      } else if (key === "w") {
        e.preventDefault();
        if (this.activeKey) this.closeTab(this.activeKey);
      } else if (key === "tab") {
        e.preventDefault();
        this.cycleTab(e.shiftKey ? -1 : 1);
      }
    });
  }

  private wireWindowClose() {
    getCurrentWebviewWindow()
      .onCloseRequested(async (event) => {
        const dirtyKeys = this.order.filter((k) => this.tabs.get(k)!.dirty);
        if (dirtyKeys.length === 0) return;
        event.preventDefault();

        const plural = dirtyKeys.length > 1;
        const names = dirtyKeys.map((k) => `"${this.tabLabel(this.tabs.get(k)!)}"`).join(", ");
        const choice = await unsavedChangesModal({
          title: "Unsaved changes",
          message: plural
            ? `You have ${dirtyKeys.length} files with unsaved changes: ${names}. Save them before quitting?`
            : `${names} has unsaved changes. Save it before quitting?`,
          saveLabel: plural ? "Save All" : "Save",
        });

        if (choice === "cancel") return;
        if (choice === "save") {
          for (const key of dirtyKeys) {
            const saved = await this.saveTab(key);
            if (!saved) return; // a Save As was cancelled — abort quitting
          }
        }
        getCurrentWebviewWindow().destroy();
      })
      .catch(() => {});
  }

  private wireDragDrop() {
    getCurrentWebviewWindow()
      .onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        const paths = event.payload.paths;
        for (const p of paths) {
          if (NOTE_EXT.test(p)) {
            await this.openFile(p);
          } else if (await pathExists(p)) {
            await this.setOpenFolder(p);
          }
        }
      })
      .catch(() => {});
  }

  themeIds() {
    return THEME_ORDER;
  }
}
