import type { EditorState } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";
import {
  readDirTree,
  readTextFile,
  writeTextFile,
  pathExists,
  pathIsDir,
  fileMtimeMs,
  loadState,
  saveState,
  pickFolder,
  pickNoteFile,
  pickSaveTarget,
  type DirNode,
  type PersistedState,
} from "./fs";
import { createTabEditorState, withTheme } from "./editor";
import { THEMES, THEME_ORDER, applyChromeTheme, BASE_EDITOR_FONT_PX, type ThemeId } from "./themes";
import { basename, isDescendant } from "./pathutil";
import { showToast } from "./toast";
import type { Tab } from "./types";
import { renderSidebar } from "./sidebar";
import { renderTabs } from "./tabs";
import { renderStatusBar, updateCursorLabel, updateDocStats } from "./statusbar";
import { openCommandPalette } from "./commandPalette";
import { unsavedChangesModal, showModal, confirmModal } from "./modal";

const RECENT_LIMIT = 30;
const CLOSED_TABS_LIMIT = 20;
const NOTE_EXT = /\.(txt|md|markdown)$/i;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
const EDITOR_ZOOM_MIN = 0.5;
const EDITOR_ZOOM_MAX = 2.5;
const EDITOR_ZOOM_STEP = 0.1;
const SIDEBAR_W_MIN = 160;
const SIDEBAR_W_MAX = 480;
const SIDEBAR_W_DEFAULT = 240;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class App {
  tabs = new Map<string, Tab>();
  order: string[] = [];
  activeKey: string | null = null;
  previewKey: string | null = null;
  openFolder: string | null = null;
  tree: DirNode | null = null;
  looseFiles: string[] = [];
  recentFiles: string[] = [];
  theme: ThemeId = "nord";
  zoom = 1;
  editorZoom = 1;
  sidebarWidth = SIDEBAR_W_DEFAULT;
  expandedDirs = new Set<string>();
  untitledCounter = 1;
  private closedTabs: string[] = [];
  private windowGeom: { x: number; y: number; width: number; height: number; maximized: boolean } | null = null;

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
    if (update.docChanged) this.scheduleDocStats();
  };

  private statsTimer: ReturnType<typeof setTimeout> | null = null;

  /** Counting words walks the whole document, so don't do it on every keystroke. */
  private scheduleDocStats() {
    if (this.statsTimer !== null) clearTimeout(this.statsTimer);
    this.statsTimer = setTimeout(() => {
      this.statsTimer = null;
      updateDocStats(this.view.state.doc.toString());
    }, 150);
  }

  /**
   * Builds a tab's editor state. The callbacks reach the tab through
   * `getTab` rather than a captured key, so they keep working after Save As
   * re-keys it, and every update is written back to `tab.state` so the tab
   * always holds what's on screen rather than a snapshot from the last tab
   * switch.
   */
  private createTabState(getTab: () => Tab, content: string, path: string): EditorState {
    return createTabEditorState(
      content,
      path,
      THEMES[this.theme],
      () => this.markDirty(getTab().key),
      (update) => {
        getTab().state = update.state;
        this.handleCursorUpdate(update);
      },
    );
  }

  // ---------- boot ----------

  async init() {
    const persisted = await loadState().catch(() => null);
    await this.restoreWindowGeometry(persisted);

    if (persisted?.theme && persisted.theme in THEMES) {
      this.theme = persisted.theme as ThemeId;
    }
    applyChromeTheme(THEMES[this.theme]);

    if (typeof persisted?.zoom === "number" && Number.isFinite(persisted.zoom)) {
      this.zoom = clamp(persisted.zoom, ZOOM_MIN, ZOOM_MAX);
    }
    document.getElementById("app")!.style.zoom = String(this.zoom);

    if (typeof persisted?.editorZoom === "number" && Number.isFinite(persisted.editorZoom)) {
      this.editorZoom = clamp(persisted.editorZoom, EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX);
    }
    this.editorHost.style.setProperty("--editor-font-size", `${(BASE_EDITOR_FONT_PX * this.editorZoom).toFixed(2)}px`);

    if (typeof persisted?.sidebarWidth === "number" && Number.isFinite(persisted.sidebarWidth)) {
      this.sidebarWidth = clamp(persisted.sidebarWidth, SIDEBAR_W_MIN, SIDEBAR_W_MAX);
    }
    document.getElementById("app")!.style.setProperty("--sidebar-w", `${this.sidebarWidth}px`);

    // load_state has already re-granted the paths this session remembers.
    if (persisted?.recentFiles) this.recentFiles = persisted.recentFiles;

    if (this.recentFiles.length > 0) {
      const exists = await Promise.all(this.recentFiles.map((p) => pathExists(p).catch(() => false)));
      this.recentFiles = this.recentFiles.filter((_, i) => exists[i]);
    }

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

    if (persisted?.pinnedTabs?.length) {
      for (const key of persisted.pinnedTabs) {
        const tab = this.tabs.get(key);
        if (tab) tab.pinned = true;
      }
    }

    if (persisted?.activeTab && this.tabs.has(persisted.activeTab)) {
      this.activateTab(persisted.activeTab);
    } else if (this.order.length > 0) {
      this.activateTab(this.order[0]);
    }

    this.renderAll();
    this.wireGlobalShortcuts();
    this.wireZoomWheel();
    this.wireSidebarResize();
    this.wireWindowClose();
    this.wireWindowGeometry();
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

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  /** Debounced: rapid successive calls (e.g. cycling tabs) collapse into one disk write. */
  private persist() {
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.flushPersist(), 300);
  }

  /** Cancels any pending debounce and writes state immediately, awaiting the write. */
  private async flushPersist(): Promise<void> {
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    const persistableKeys = this.order.filter((k) => !this.tabs.get(k)!.isUntitled);
    const openTabs = persistableKeys.map((k) => this.tabs.get(k)!.path!);
    const pinnedTabs = persistableKeys.filter((k) => this.tabs.get(k)!.pinned).map((k) => this.tabs.get(k)!.path!);
    await saveState({
      theme: this.theme,
      zoom: this.zoom,
      editorZoom: this.editorZoom,
      sidebarWidth: this.sidebarWidth,
      lastFolder: this.openFolder ?? undefined,
      recentFiles: this.recentFiles,
      openTabs,
      activeTab: this.activeKey && !this.tabs.get(this.activeKey)?.isUntitled ? this.activeKey : undefined,
      pinnedTabs,
      windowX: this.windowGeom?.x,
      windowY: this.windowGeom?.y,
      windowWidth: this.windowGeom?.width,
      windowHeight: this.windowGeom?.height,
      windowMaximized: this.windowGeom?.maximized,
    }).catch(() => {});
  }

  // ---------- folder ----------

  async openFolderDialog() {
    const picked = await pickFolder().catch((e) => {
      showToast(`Couldn't open folder: ${e}`, "error");
      return null;
    });
    if (picked) await this.setOpenFolder(picked);
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
    const picked = await pickNoteFile().catch((e) => {
      showToast(`Couldn't open file: ${e}`, "error");
      return null;
    });
    if (picked) await this.openFile(picked);
  }

  /**
   * Tracks in-flight reads per path. A fast double-click fires two `click`s
   * and a `dblclick` before the first disk read resolves; without this, each
   * would see `tabs.has(path)` as false and race to create its own tab. Every
   * call but the first now awaits that one real read, then re-enters
   * `openFile` to apply its own preview/pin/activate semantics against the
   * tab the first call created.
   */
  private opening = new Map<string, Promise<void>>();

  async openFile(
    path: string,
    opts: { activate?: boolean; skipPersist?: boolean; skipRecent?: boolean; preview?: boolean } = {},
  ): Promise<void> {
    const activate = opts.activate ?? true;
    if (this.tabs.has(path)) {
      if (!opts.preview && this.previewKey === path) this.promoteTab(path);
      if (activate) this.activateTab(path);
      return;
    }
    const pending = this.opening.get(path);
    if (pending) {
      await pending;
      return this.openFile(path, opts);
    }
    const task = this.loadAndCreateTab(path, opts);
    this.opening.set(path, task);
    try {
      await task;
    } finally {
      this.opening.delete(path);
    }
  }

  private async loadAndCreateTab(
    path: string,
    opts: { activate?: boolean; skipPersist?: boolean; skipRecent?: boolean; preview?: boolean },
  ) {
    const activate = opts.activate ?? true;
    let content: string;
    try {
      const result = await readTextFile(path);
      content = result.contents;
      if (result.lossy) {
        showToast(`${basename(path)} isn't valid UTF-8; opened with replacement characters. Saving will rewrite the encoding.`, "error");
      }
    } catch (e) {
      showToast(`Couldn't open ${basename(path)}: ${e}`, "error");
      return;
    }
    const mtime = await fileMtimeMs(path).catch(() => null);
    const tab: Tab = {
      key: path,
      path,
      isUntitled: false,
      state: this.createTabState(() => tab, content, path),
      dirty: false,
      diskMtime: mtime,
      pinned: false,
    };

    // A preview tab takes the slot of the previous preview tab (if any and
    // not dirty) instead of piling up a new tab, matching editors like VS
    // Code: browsing files from the sidebar reuses one "peek" tab until the
    // user commits to it by editing or double-clicking.
    const replaceIdx = opts.preview && this.previewKey && !this.tabs.get(this.previewKey)?.dirty
      ? this.order.indexOf(this.previewKey)
      : -1;
    if (replaceIdx !== -1) {
      this.tabs.delete(this.previewKey!);
      this.order[replaceIdx] = path;
    } else {
      this.order.push(path);
    }
    this.tabs.set(path, tab);
    if (opts.preview) this.previewKey = path;

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

  /** Promotes a preview ("peek") tab to a full, persistent tab. No-op if it isn't a preview tab. */
  promoteTab(key: string) {
    if (this.previewKey !== key) return;
    this.previewKey = null;
    renderTabs(this);
  }

  /**
   * Toggles a tab's pinned state. Pinned tabs move to (and stay at) the front
   * of the strip and are skipped by "Close Others" / "Close All", distinct
   * from `promoteTab`'s unrelated preview-tab promotion.
   */
  togglePinTab(key: string) {
    const tab = this.tabs.get(key);
    if (!tab) return;
    tab.pinned = !tab.pinned;
    if (tab.pinned) {
      if (this.previewKey === key) this.previewKey = null;
      this.order = this.order.filter((k) => k !== key);
      const firstUnpinnedIdx = this.order.findIndex((k) => !this.tabs.get(k)!.pinned);
      this.order.splice(firstUnpinnedIdx === -1 ? this.order.length : firstUnpinnedIdx, 0, key);
    }
    renderTabs(this);
    this.persist();
  }

  /** Closes every tab except `key`, leaving pinned tabs untouched. */
  async closeOtherTabs(key: string) {
    const toClose = this.order.filter((k) => k !== key && !this.tabs.get(k)!.pinned);
    for (const k of toClose) await this.closeTab(k);
  }

  /** Closes every unpinned tab. */
  async closeAllTabs() {
    const toClose = this.order.filter((k) => !this.tabs.get(k)!.pinned);
    for (const k of toClose) await this.closeTab(k);
  }

  newUntitledTab() {
    const key = `untitled:${this.untitledCounter++}`;
    const tab: Tab = {
      key,
      path: null,
      isUntitled: true,
      state: this.createTabState(() => tab, "", "untitled.md"),
      dirty: false,
      diskMtime: null,
      pinned: false,
    };
    this.tabs.set(key, tab);
    this.order.push(key);
    this.activateTab(key);
  }

  activateTab(key: string) {
    const tab = this.tabs.get(key);
    if (!tab) return;
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
    if (!tab.isUntitled && tab.path) {
      this.closedTabs.push(tab.path);
      if (this.closedTabs.length > CLOSED_TABS_LIMIT) this.closedTabs.shift();
    }
    this.tabs.delete(key);
    this.order = this.order.filter((k) => k !== key);
    if (this.previewKey === key) this.previewKey = null;
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

  reopenLastClosedTab() {
    let path = this.closedTabs.pop();
    while (path && this.tabs.has(path)) path = this.closedTabs.pop();
    if (!path) return;
    this.openFile(path);
  }

  cycleTab(direction: 1 | -1) {
    if (this.order.length < 2 || !this.activeKey) return;
    const idx = this.order.indexOf(this.activeKey);
    const next = this.order[(idx + direction + this.order.length) % this.order.length];
    this.activateTab(next);
  }

  markDirty(key: string) {
    const tab = this.tabs.get(key);
    if (!tab || tab.dirty) return;
    tab.dirty = true;
    if (this.previewKey === key) this.previewKey = null;
    renderTabs(this);
    renderSidebar(this);
    renderStatusBar(this);
  }

  tabLabel(tab: Tab): string {
    if (tab.isUntitled) return "Untitled";
    return basename(tab.path!);
  }

  async saveActiveTab() {
    if (!this.activeKey) return;
    await this.saveTab(this.activeKey);
  }

  async saveActiveTabAs() {
    if (!this.activeKey) return;
    await this.saveTabAs(this.activeKey);
  }

  /** Saves a tab (prompting Save As for untitled tabs). Returns the saved Tab on success, null if cancelled/failed. */
  async saveTab(key: string): Promise<Tab | null> {
    const tab = this.tabs.get(key);
    if (!tab) return null;
    if (tab.isUntitled) return this.saveTabAs(key);
    const ok = await this.writeTab(tab);
    return ok ? tab : null;
  }

  private async saveTabAs(key: string): Promise<Tab | null> {
    const tab = this.tabs.get(key);
    if (!tab) return null;
    const picked = await pickSaveTarget(tab.isUntitled ? "Untitled.md" : tab.path!).catch((e) => {
      showToast(`Couldn't save: ${e}`, "error");
      return null;
    });
    if (!picked) return null;
    const target = picked.path;

    // The dialog only confirmed overwriting the name as typed; if Rust had
    // to append `.md`, that file may exist and nobody has agreed to lose it.
    if (picked.extensionAdded && (await pathExists(target).catch(() => false))) {
      const replace = await confirmModal({
        title: "Replace file?",
        message: `"${basename(target)}" already exists. Do you want to replace it?`,
        confirmLabel: "Replace",
        danger: true,
      });
      if (!replace) return null;
    }

    // Refuse to save onto a path that's already open in another tab: silently
    // re-keying onto it would orphan that tab's Map entry, dropping its
    // buffer (including unsaved edits) with no warning.
    const existing = this.tabs.get(target);
    if (existing && existing !== tab) {
      showToast(`"${basename(target)}" is already open in another tab`, "error");
      return null;
    }

    // Write before re-keying, so a failed save leaves the tab on its old
    // path. This skips writeTab's changed-on-disk check on purpose: the
    // user just chose to overwrite whatever is at the target.
    try {
      await writeTextFile(target, tab.state.doc.toString());
    } catch (e) {
      showToast(`Couldn't save: ${e}`, "error");
      return null;
    }
    this.rekeyTab(tab, key, target);
    tab.dirty = false;
    tab.diskMtime = await fileMtimeMs(target).catch(() => Date.now());
    if (!this.openFolder || !isDescendant(this.openFolder, target)) {
      if (!this.looseFiles.includes(target)) this.looseFiles.push(target);
    }
    this.touchRecent(target);

    renderTabs(this);
    renderSidebar(this);
    renderStatusBar(this);
    this.persist();
    showToast(`Saved ${basename(target)}`);
    return tab;
  }

  /** Re-keys a tab's Map entry and order slot after Save As changes its path. */
  private rekeyTab(tab: Tab, oldKey: string, newKey: string) {
    this.tabs.delete(oldKey);
    this.order = this.order.map((k) => (k === oldKey ? newKey : k));
    tab.key = newKey;
    tab.path = newKey;
    tab.isUntitled = false;
    if (this.activeKey === oldKey) this.activeKey = newKey;
    if (this.previewKey === oldKey) this.previewKey = newKey;
    this.tabs.set(newKey, tab);
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
      const result = await readTextFile(tab.path!);
      const mtime = await fileMtimeMs(tab.path!).catch(() => Date.now());
      tab.state = this.createTabState(() => tab, result.contents, tab.path!);
      tab.dirty = false;
      tab.diskMtime = mtime;
      if (this.activeKey === tab.key) this.view.setState(tab.state);
      renderTabs(this);
      renderStatusBar(this);
      showToast(`Reloaded ${basename(tab.path!)} from disk`);
      if (result.lossy) {
        showToast(`${basename(tab.path!)} isn't valid UTF-8; reloaded with replacement characters.`, "error");
      }
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
    for (const tab of this.tabs.values()) {
      tab.state = withTheme(tab.state, tokens);
    }
    if (this.activeKey) this.view.setState(this.tabs.get(this.activeKey)!.state);
    renderStatusBar(this);
    this.persist();
  }

  // ---------- zoom ----------

  setZoom(level: number) {
    const clamped = Math.round(clamp(level, ZOOM_MIN, ZOOM_MAX) * 100) / 100;
    if (clamped === this.zoom) return;
    this.zoom = clamped;
    document.getElementById("app")!.style.zoom = String(this.zoom);
    this.persist();
  }

  setEditorZoom(level: number) {
    const clamped = Math.round(clamp(level, EDITOR_ZOOM_MIN, EDITOR_ZOOM_MAX) * 100) / 100;
    if (clamped === this.editorZoom) return;
    this.editorZoom = clamped;
    this.editorHost.style.setProperty("--editor-font-size", `${(BASE_EDITOR_FONT_PX * this.editorZoom).toFixed(2)}px`);
    this.persist();
  }

  // ---------- sidebar resize ----------

  setSidebarWidth(width: number) {
    const clamped = Math.round(clamp(width, SIDEBAR_W_MIN, SIDEBAR_W_MAX));
    if (clamped === this.sidebarWidth) return;
    this.sidebarWidth = clamped;
    document.getElementById("app")!.style.setProperty("--sidebar-w", `${this.sidebarWidth}px`);
  }

  private wireSidebarResize() {
    const handle = document.getElementById("sidebar-resizer")!;
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      handle.classList.add("dragging");
      document.body.style.cursor = "col-resize";

      const onMove = (moveEvent: MouseEvent) => {
        this.setSidebarWidth(moveEvent.clientX / this.zoom);
      };
      const onUp = () => {
        handle.classList.remove("dragging");
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        this.persist();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
    handle.addEventListener("dblclick", () => {
      this.setSidebarWidth(SIDEBAR_W_DEFAULT);
      this.persist();
    });
  }

  // ---------- shortcuts / lifecycle ----------

  private wireZoomWheel() {
    window.addEventListener(
      "wheel",
      (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const overEditor = e.target instanceof Node && this.editorHost.contains(e.target);
        if (overEditor) {
          this.setEditorZoom(this.editorZoom - Math.sign(e.deltaY) * EDITOR_ZOOM_STEP);
        } else {
          this.setZoom(this.zoom - Math.sign(e.deltaY) * ZOOM_STEP);
        }
      },
      { passive: false },
    );
  }

  private wireGlobalShortcuts() {
    window.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const overlay = document.getElementById("confirm-overlay");
      if (overlay && !overlay.classList.contains("hidden")) return;
      const key = e.key.toLowerCase();

      if (key === "p" && !e.shiftKey) {
        e.preventDefault();
        openCommandPalette(this);
      } else if (key === "s" && e.shiftKey) {
        e.preventDefault();
        this.saveActiveTabAs();
      } else if (key === "s") {
        e.preventDefault();
        this.saveActiveTab();
      } else if (key === "t" && e.shiftKey) {
        e.preventDefault();
        this.reopenLastClosedTab();
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
      } else if (key === "=" || key === "+") {
        e.preventDefault();
        this.setZoom(this.zoom + ZOOM_STEP);
      } else if (key === "-") {
        e.preventDefault();
        this.setZoom(this.zoom - ZOOM_STEP);
      } else if (key === "0") {
        e.preventDefault();
        this.setZoom(1);
      }
    });
  }

  private wireWindowClose() {
    getCurrentWebviewWindow()
      .onCloseRequested(async (event) => {
        // Always prevented and re-driven manually below: the default close
        // proceeds immediately and would tear the webview down before the
        // async state flush (window geometry, zoom, etc.) below ever reaches
        // disk, silently losing whatever changed since the last debounce.
        event.preventDefault();

        const dirtyKeys = this.order.filter((k) => this.tabs.get(k)!.dirty);
        if (dirtyKeys.length > 0) {
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
        }
        await this.captureWindowGeom();
        await this.flushPersist();
        getCurrentWebviewWindow().destroy();
      })
      .catch(() => {});
  }

  // ---------- window geometry ----------

  /** Applies persisted size/position/maximized state before the (still-hidden) window is shown. */
  private async restoreWindowGeometry(persisted: PersistedState | null): Promise<void> {
    const win = getCurrentWebviewWindow();
    const width = persisted?.windowWidth;
    const height = persisted?.windowHeight;
    if (typeof width === "number" && typeof height === "number") {
      await win.setSize(new PhysicalSize(width, height)).catch(() => {});
    }
    const x = persisted?.windowX;
    const y = persisted?.windowY;
    if (typeof x === "number" && typeof y === "number" && (await this.rectOnAnyMonitor(x, y, width ?? 0, height ?? 0))) {
      await win.setPosition(new PhysicalPosition(x, y)).catch(() => {});
    }
    if (persisted?.windowMaximized) {
      await win.maximize().catch(() => {});
    }
    await this.captureWindowGeom();
  }

  /** True if the given physical-pixel rect overlaps a currently-connected monitor's bounds. */
  private async rectOnAnyMonitor(x: number, y: number, width: number, height: number): Promise<boolean> {
    try {
      const monitors = await availableMonitors();
      return monitors.some((m) => {
        const mx2 = m.position.x + m.size.width;
        const my2 = m.position.y + m.size.height;
        return x < mx2 && x + width > m.position.x && y < my2 && y + height > m.position.y;
      });
    } catch {
      return false;
    }
  }

  /**
   * Records the window's current bounds for persistence. While maximized, the
   * last known restored (un-maximized) bounds are kept as-is — only the
   * `maximized` flag flips — so unmaximizing next launch has somewhere to
   * return to instead of snapping to the maximized size.
   */
  private async captureWindowGeom(): Promise<void> {
    const win = getCurrentWebviewWindow();
    try {
      const maximized = await win.isMaximized();
      if (maximized) {
        this.windowGeom = { ...(this.windowGeom ?? { x: 0, y: 0, width: 0, height: 0 }), maximized: true };
        return;
      }
      const pos = await win.outerPosition();
      const size = await win.outerSize();
      this.windowGeom = { x: pos.x, y: pos.y, width: size.width, height: size.height, maximized: false };
    } catch {
      /* window may already be closing; leave the last known geometry as-is */
    }
  }

  private wireWindowGeometry() {
    const win = getCurrentWebviewWindow();
    const onChange = () => {
      this.captureWindowGeom().then(() => this.persist());
    };
    win.onResized(onChange).catch(() => {});
    win.onMoved(onChange).catch(() => {});
  }

  private wireDragDrop() {
    // Emitted by Rust once it has granted the dropped paths (on_drop in
    // src-tauri/src/lib.rs), in place of Tauri's own drag-drop event.
    listen<string[]>("notes://drop", async (event) => {
      for (const p of event.payload) {
        if (NOTE_EXT.test(p)) {
          await this.openFile(p);
        } else if (await pathIsDir(p)) {
          await this.setOpenFolder(p);
        }
      }
    }).catch(() => {});
  }

  themeIds() {
    return THEME_ORDER;
  }
}
