import { Annotation, Text, type EditorState } from "@codemirror/state";
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
  renameNote,
  createNote,
  trashNote,
  folderContents,
  renameFolder,
  trashFolder,
  revealPath,
  dirTreesEqual,
  type DirNode,
  type PersistedState,
} from "./fs";
import { createTabEditorState, languageName, withLanguage, withTheme } from "./editor";
import { THEMES, THEME_ORDER, applyChromeTheme, BASE_EDITOR_FONT_PX, type ThemeId } from "./themes";
import { basename, joinPath, suggestedFileName, isUnder } from "./pathutil";
import { detectLineEnding, textForDisk } from "./lineEndings";
import { showToast } from "./toast";
import type { Tab } from "./types";
import { renderSidebar } from "./sidebar";
import { renderTabs } from "./tabs";
import { renderStatusBar, updateCursorLabel, updateDocStats } from "./statusbar";
import { openCommandPalette } from "./commandPalette";
import { unsavedChangesModal, showModal, confirmModal, promptModal } from "./modal";
import { folderContentsPhrase, trashName } from "./sidebarMenu";
import { minimalChange } from "./textDiff";

const RECENT_LIMIT = 30;
const CLOSED_TABS_LIMIT = 20;
const NOTE_EXT = /\.(txt|md|markdown|json)$/i;
/** `"a.md"`, `"a.md" and "b.md"`, or `"a.md", "b.md" and 3 others` for messages. */
function quotedNames(paths: string[]): string {
  const names = paths.map((p) => `"${basename(p)}"`);
  if (names.length === 1) return names[0];
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
const EDITOR_ZOOM_MIN = 0.5;
const EDITOR_ZOOM_MAX = 2.5;
const EDITOR_ZOOM_STEP = 0.1;
const SIDEBAR_W_MIN = 160;
const SIDEBAR_W_MAX = 480;
const SIDEBAR_W_DEFAULT = 240;

/** Marks the transaction that applies an outside edit to a clean tab. */
const reloadedFromDisk = Annotation.define<boolean>();

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
      (update) => this.updateDirty(getTab().key, !update.transactions.some((tr) => tr.annotation(reloadedFromDisk))),
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

    if (persisted?.looseFiles?.length) {
      const exists = await Promise.all(persisted.looseFiles.map((p) => pathExists(p).catch(() => false)));
      this.looseFiles = persisted.looseFiles.filter((_, i) => exists[i]);
    }

    if (persisted?.lastFolder && (await pathExists(persisted.lastFolder))) {
      await this.setOpenFolder(persisted.lastFolder, { skipPersist: true });
    }

    if (persisted?.openTabs?.length) {
      const missing: string[] = [];
      for (const path of persisted.openTabs) {
        if (await pathExists(path)) {
          await this.openFile(path, { activate: false, skipPersist: true, skipRecent: true });
        } else {
          missing.push(path);
        }
      }
      // Said once: the session saved next won't list them again.
      if (missing.length > 0) {
        showToast(`Couldn't reopen ${quotedNames(missing)}: moved or deleted since Notes last ran.`);
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
    this.wireFolderRefresh();
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
      looseFiles: this.looseFiles,
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
      showToast(`Couldn't open folder: ${String(e)}`, "error");
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

  private refreshSeq = 0;

  /**
   * Re-reads the open folder from disk. Nothing watches the folder for
   * outside changes (another editor, a sync client, Explorer), so this is
   * called on a manual refresh click and on window focus regain. Skips the
   * render when the tree came back unchanged, and leaves the last-known
   * tree in place on error rather than surfacing a toast on every focus
   * regain (e.g. a network drive that's briefly unreachable).
   */
  async refreshFolder(): Promise<void> {
    const folder = this.openFolder;
    if (!folder) return;
    const seq = ++this.refreshSeq;
    const next = await readDirTree(folder).catch(() => null);
    // The open folder may have changed (or been closed) while this read was
    // in flight — e.g. focus regains right as a folder picker resolves. And
    // a later refresh may have started: closing the save dialog refocuses
    // the window just before the file is written, and that read must not
    // land after the one that sees the new file.
    if (!next || seq !== this.refreshSeq || folder !== this.openFolder || dirTreesEqual(this.tree, next)) return;
    this.tree = next;
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
        showToast(
          `${basename(path)} isn't valid UTF-8; opened with replacement characters. Saving will rewrite the encoding.`,
          "error",
        );
      }
    } catch (e) {
      showToast(`Couldn't open ${basename(path)}: ${String(e)}`, "error");
      return;
    }
    const mtime = await fileMtimeMs(path).catch(() => null);
    const tab: Tab = {
      key: path,
      path,
      isUntitled: false,
      state: this.createTabState(() => tab, content, path),
      dirty: false,
      savedDoc: Text.empty,
      diskMtime: mtime,
      pinned: false,
      lineEnding: detectLineEnding(content),
    };
    tab.savedDoc = tab.state.doc;

    // A preview tab takes the slot of the previous preview tab (if any and
    // not dirty) instead of piling up a new tab, matching editors like VS
    // Code: browsing files from the sidebar reuses one "peek" tab until the
    // user commits to it by editing or double-clicking.
    const replaceIdx =
      opts.preview && this.previewKey && !this.tabs.get(this.previewKey)?.dirty
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
    // The lowest number no open untitled tab has, so tabs read "Untitled",
    // "Untitled 2", ... and the numbers are reused as they close.
    let n = 1;
    while (this.tabs.has(`untitled:${n}`)) n++;
    const key = `untitled:${n}`;
    const tab: Tab = {
      key,
      path: null,
      isUntitled: true,
      state: this.createTabState(() => tab, "", "untitled.md"),
      dirty: false,
      savedDoc: Text.empty,
      diskMtime: null,
      pinned: false,
      lineEnding: "\n",
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
    // Closing the active tab moves to its right-hand neighbour, or the left
    // one at the end of the strip, as browsers and most editors do.
    const idx = this.order.indexOf(key);
    this.tabs.delete(key);
    this.order = this.order.filter((k) => k !== key);
    if (this.previewKey === key) this.previewKey = null;
    if (this.activeKey === key) {
      const next = this.order[Math.min(idx, this.order.length - 1)] ?? null;
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
    void this.openFile(path);
  }

  cycleTab(direction: 1 | -1) {
    if (this.order.length < 2 || !this.activeKey) return;
    const idx = this.order.indexOf(this.activeKey);
    const next = this.order[(idx + direction + this.order.length) % this.order.length];
    this.activateTab(next);
  }

  /**
   * Recomputes a tab's dirty flag after an edit by comparing the buffer with
   * what was last loaded or saved, so typing a character and deleting it
   * again leaves the tab clean. A user edit promotes a preview tab, even
   * one that's undone; a reload from disk doesn't.
   */
  updateDirty(key: string, userEdit = true) {
    const tab = this.tabs.get(key);
    if (!tab) return;
    const dirty = !tab.state.doc.eq(tab.savedDoc);
    const wasPreview = userEdit && this.previewKey === key;
    if (dirty === tab.dirty && !wasPreview) return;
    tab.dirty = dirty;
    if (wasPreview) this.previewKey = null;
    renderTabs(this);
    renderSidebar(this);
    renderStatusBar(this);
  }

  /**
   * Records `doc` as the tab's on-disk content. Edits typed while the write
   * was in flight aren't in `doc`, so they keep the tab dirty.
   */
  private markSaved(tab: Tab, doc: Text) {
    tab.savedDoc = doc;
    tab.dirty = !tab.state.doc.eq(doc);
  }

  tabLabel(tab: Tab): string {
    if (tab.isUntitled) {
      const n = Number(tab.key.slice("untitled:".length));
      return n > 1 ? `Untitled ${n}` : "Untitled";
    }
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
    // Nothing to write. Skipping it also spares sync clients and folder
    // watchers (Notepad++ lists a phantom copy per atomic save) a no-op.
    if (!tab.dirty) return tab;
    const ok = await this.writeTab(tab);
    return ok ? tab : null;
  }

  private async saveTabAs(key: string): Promise<Tab | null> {
    const tab = this.tabs.get(key);
    if (!tab) return null;
    // A new note starts in the open folder, if there is one; otherwise the
    // dialog opens wherever the OS last left it.
    const name = `${suggestedFileName(tab.state.doc.toString())}.md`;
    const defaultPath = tab.isUntitled ? (this.openFolder ? joinPath(this.openFolder, name) : name) : tab.path!;
    const picked = await pickSaveTarget(defaultPath).catch((e) => {
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
    const doc = tab.state.doc;
    try {
      await writeTextFile(target, textForDisk(doc, tab.lineEnding));
    } catch (e) {
      showToast(`Couldn't save: ${String(e)}`, "error");
      return null;
    }
    this.rekeyTab(tab, key, target);
    this.markSaved(tab, doc);
    tab.diskMtime = await fileMtimeMs(target).catch(() => Date.now());
    this.touchRecent(target);
    // Show the new file in the sidebar if it landed in the open folder.
    await this.refreshFolder();

    renderTabs(this);
    renderSidebar(this);
    renderStatusBar(this);
    this.persist();
    showToast(`Saved ${basename(target)}`);
    return tab;
  }

  /**
   * Re-keys a tab's Map entry and order slot after Save As or a rename
   * changes its path, and switches its highlighting if the extension moved
   * to a different language (untitled tabs start as Markdown).
   */
  private rekeyTab(tab: Tab, oldKey: string, newKey: string) {
    const oldPath = tab.path ?? "untitled.md";
    if (languageName(oldPath) !== languageName(newKey)) {
      tab.state = withLanguage(tab.state, newKey);
      if (this.activeKey === oldKey) this.view.setState(tab.state);
    }
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
            // Both other choices throw one version away, so a reflex Enter cancels.
            { id: "cancel", label: "Cancel", variant: "ghost", autofocus: true },
            { id: "reload", label: "Reload from Disk", variant: "ghost", danger: true },
            { id: "overwrite", label: "Overwrite" },
          ],
        });
        if (choice === "reload") {
          await this.reloadTabFromDisk(tab);
          return true;
        }
        if (choice !== "overwrite") return false;
      }
    }

    const doc = tab.state.doc;
    try {
      await writeTextFile(tab.path!, textForDisk(doc, tab.lineEnding));
      this.markSaved(tab, doc);
      tab.diskMtime = await fileMtimeMs(tab.path!).catch(() => Date.now());
      renderTabs(this);
      renderSidebar(this);
      renderStatusBar(this);
      this.persist();
      showToast(`Saved ${basename(tab.path!)}`);
      return true;
    } catch (e) {
      showToast(`Couldn't save: ${String(e)}`, "error");
      return false;
    }
  }

  private async reloadTabFromDisk(tab: Tab) {
    try {
      const result = await readTextFile(tab.path!);
      const mtime = await fileMtimeMs(tab.path!).catch(() => Date.now());
      tab.state = this.createTabState(() => tab, result.contents, tab.path!);
      tab.lineEnding = detectLineEnding(result.contents);
      this.markSaved(tab, tab.state.doc);
      tab.diskMtime = mtime;
      if (this.activeKey === tab.key) this.view.setState(tab.state);
      renderTabs(this);
      renderSidebar(this);
      renderStatusBar(this);
      showToast(`Reloaded ${basename(tab.path!)} from disk`);
      if (result.lossy) {
        showToast(`${basename(tab.path!)} isn't valid UTF-8; reloaded with replacement characters.`, "error");
      }
    } catch (e) {
      showToast(`Couldn't reload: ${String(e)}`, "error");
    }
  }

  /**
   * Picks up outside edits to open files, like VS Code: a tab without
   * unsaved changes whose file changed on disk is quietly updated to match.
   * Only the changed span is replaced, so the cursor and scroll stay put,
   * and the reload is one undo step. Tabs with unsaved changes are left
   * alone; saving them shows the "File changed on disk" choice. A file
   * that's gone or unreadable is skipped, as is any tab edited, closed or
   * renamed while its read was in flight.
   */
  async reloadChangedTabs() {
    const candidates = [...this.tabs.values()].filter((t) => !t.dirty && !t.isUntitled);
    await Promise.all(candidates.map((tab) => this.reloadIfChanged(tab)));
  }

  private async reloadIfChanged(tab: Tab) {
    const path = tab.path!;
    const mtime = await fileMtimeMs(path).catch(() => null);
    if (mtime == null || mtime === tab.diskMtime) return;
    const result = await readTextFile(path).catch(() => null);
    if (!result || tab.dirty || this.tabs.get(tab.key) !== tab || tab.path !== path) return;

    // toText normalizes line breaks the way the editor does, so a file
    // saved with CRLF compares equal to the same text already open.
    const after = tab.state.toText(result.contents);
    tab.diskMtime = mtime;
    tab.lineEnding = detectLineEnding(result.contents);
    const change = minimalChange(tab.state.doc.toString(), after.toString());
    if (!change) return;
    const tr = tab.state.update({ changes: change, annotations: reloadedFromDisk.of(true) });
    // Record the new text as saved before applying it, so the update
    // listener sees a clean tab.
    tab.savedDoc = tr.newDoc;
    if (this.activeKey === tab.key) {
      this.view.dispatch(tr);
    } else {
      tab.state = tr.state;
    }
    if (result.lossy) {
      showToast(
        `${basename(path)} changed on disk and isn't valid UTF-8; reloaded with replacement characters.`,
        "error",
      );
    }
  }

  /**
   * Lists a file from outside the open folder under "Other Files" in the
   * sidebar. Opening or dropping a file doesn't do this; only the user does.
   */
  addLooseFile(path: string) {
    if (this.looseFiles.includes(path)) return;
    this.looseFiles.push(path);
    renderSidebar(this);
    this.persist();
  }

  closeLooseFile(path: string) {
    this.looseFiles = this.looseFiles.filter((p) => p !== path);
    renderSidebar(this);
    this.persist();
  }

  /**
   * Asks for a name and creates an empty note in `dir` (the open folder by
   * default), then opens it. Leaving off the extension makes it Markdown.
   */
  async newNoteInFolder(dir = this.openFolder) {
    if (!dir) return;
    const entered = await promptModal({
      title: "New Note",
      message: `Name for the new note in "${basename(dir)}":`,
      value: "Untitled.md",
      selectTo: "Untitled".length,
      confirmLabel: "Create",
    });
    let name = entered?.trim();
    if (!name) return;
    if (!NOTE_EXT.test(name)) name += ".md";

    let path: string;
    try {
      path = await createNote(dir, name);
    } catch (e) {
      showToast(`Couldn't create note: ${String(e)}`, "error");
      return;
    }
    this.expandedDirs.add(dir);
    await this.refreshFolder();
    await this.openFile(path);
  }

  /**
   * Asks for a new name and renames a note in its folder, carrying an open
   * tab (and any unsaved edits in it) over to the new name. Leaving off the
   * extension keeps the old one.
   */
  async renameFile(path: string) {
    const name = basename(path);
    const dot = name.lastIndexOf(".");
    const entered = await promptModal({
      title: "Rename",
      message: `New name for "${name}":`,
      value: name,
      selectTo: dot > 0 ? dot : undefined,
      confirmLabel: "Rename",
    });
    let newName = entered?.trim();
    if (!newName || newName === name) return;
    if (!NOTE_EXT.test(newName) && dot > 0) newName += name.slice(dot);

    let newPath: string;
    try {
      newPath = await renameNote(path, newName);
    } catch (e) {
      showToast(`Couldn't rename: ${String(e)}`, "error");
      return;
    }
    const tab = this.tabs.get(path);
    if (tab) this.rekeyTab(tab, path, newPath);
    const swap = (p: string) => (p === path ? newPath : p);
    this.looseFiles = this.looseFiles.map(swap);
    this.recentFiles = this.recentFiles.map(swap);
    this.closedTabs = this.closedTabs.map(swap);
    await this.refreshFolder();
    this.renderAll();
    this.persist();
  }

  /**
   * Moves a note to the Recycle Bin / Trash after asking, and closes its tab
   * without the save prompt: there is nothing left to save it to.
   */
  async deleteFile(path: string) {
    const tab = this.tabs.get(path);
    const confirmed = await confirmModal({
      title: "Delete file?",
      message:
        `"${basename(path)}" will be moved to the ${trashName()}.` +
        (tab?.dirty ? " Its unsaved changes will be lost." : ""),
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await trashNote(path);
    } catch (e) {
      showToast(`Couldn't delete: ${String(e)}`, "error");
      return;
    }
    if (tab) {
      tab.dirty = false;
      await this.closeTab(path);
    }
    const others = (p: string) => p !== path;
    this.looseFiles = this.looseFiles.filter(others);
    this.recentFiles = this.recentFiles.filter(others);
    this.closedTabs = this.closedTabs.filter(others);
    await this.refreshFolder();
    renderSidebar(this);
    this.persist();
  }

  /**
   * Asks for a new name and renames a folder inside the open folder, then
   * re-points everything that named a path under it: open tabs (unsaved
   * edits included), Other Files, recent and closed tabs, expanded folders.
   */
  async renameFolder(dir: string) {
    const name = basename(dir);
    const entered = await promptModal({
      title: "Rename Folder",
      message: `New name for "${name}":`,
      value: name,
      confirmLabel: "Rename",
    });
    const newName = entered?.trim();
    if (!newName || newName === name) return;

    let newDir: string;
    try {
      newDir = await renameFolder(dir, newName);
    } catch (e) {
      showToast(`Couldn't rename: ${String(e)}`, "error");
      return;
    }
    const move = (p: string) => (p === dir || isUnder(dir, p) ? newDir + p.slice(dir.length) : p);
    // A snapshot: rekeyTab changes the map as this goes.
    for (const [key, tab] of Array.from(this.tabs)) {
      const moved = move(key);
      if (moved !== key) this.rekeyTab(tab, key, moved);
    }
    this.looseFiles = this.looseFiles.map(move);
    this.recentFiles = this.recentFiles.map(move);
    this.closedTabs = this.closedTabs.map(move);
    this.expandedDirs = new Set([...this.expandedDirs].map(move));
    await this.refreshFolder();
    this.renderAll();
    this.persist();
  }

  /**
   * Moves a folder inside the open folder to the Recycle Bin / Trash after a
   * confirmation that says what goes with it, including the files the tree
   * doesn't show, then closes the tabs that were inside it without the save
   * prompt: there is nothing left to save them to.
   */
  async deleteFolder(dir: string) {
    let contents;
    try {
      contents = await folderContents(dir);
    } catch (e) {
      showToast(`Couldn't delete: ${String(e)}`, "error");
      return;
    }
    const inside = (p: string) => isUnder(dir, p);
    const unsaved = [...this.tabs.values()].filter((t) => t.path && inside(t.path) && t.dirty).length;
    const confirmed = await confirmModal({
      title: "Delete folder?",
      message:
        `"${basename(dir)}" will be moved to the ${trashName()}${folderContentsPhrase(contents)}.` +
        (unsaved === 1 ? " An open note in it has unsaved changes, which will be lost." : "") +
        (unsaved > 1 ? ` ${unsaved} open notes in it have unsaved changes, which will be lost.` : ""),
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await trashFolder(dir);
    } catch (e) {
      showToast(`Couldn't delete: ${String(e)}`, "error");
      return;
    }
    // A snapshot: closeTab removes entries as this goes.
    for (const [key, tab] of Array.from(this.tabs)) {
      if (!inside(key)) continue;
      tab.dirty = false;
      await this.closeTab(key);
    }
    const outside = (p: string) => p !== dir && !inside(p);
    this.looseFiles = this.looseFiles.filter(outside);
    this.recentFiles = this.recentFiles.filter(outside);
    this.closedTabs = this.closedTabs.filter(outside);
    this.expandedDirs = new Set([...this.expandedDirs].filter(outside));
    await this.refreshFolder();
    renderSidebar(this);
    this.persist();
  }

  async revealPath(path: string) {
    await revealPath(path).catch((e) => showToast(`Couldn't show it: ${String(e)}`, "error"));
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
      if ((document.getElementById("confirm-modal") as HTMLDialogElement).open) return;
      const key = e.key.toLowerCase();

      if (key === "p" && !e.shiftKey) {
        e.preventDefault();
        openCommandPalette(this);
      } else if (key === "s" && e.shiftKey) {
        e.preventDefault();
        void this.saveActiveTabAs();
      } else if (key === "s") {
        e.preventDefault();
        void this.saveActiveTab();
      } else if (key === "t" && e.shiftKey) {
        e.preventDefault();
        this.reopenLastClosedTab();
      } else if (key === "o" && e.shiftKey) {
        e.preventDefault();
        void this.openFolderDialog();
      } else if (key === "o") {
        e.preventDefault();
        void this.openFileDialog();
      } else if (key === "n") {
        e.preventDefault();
        this.newUntitledTab();
      } else if (key === "w") {
        e.preventDefault();
        if (this.activeKey) void this.closeTab(this.activeKey);
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
        if (await this.prepareToExit("quitting")) void getCurrentWebviewWindow().destroy();
      })
      .catch(() => {});
  }

  /**
   * Asks about unsaved tabs, then saves the session, before the app goes
   * away: on quit, and before an update's installer replaces it. Returns
   * false if the user cancelled (or cancelled a Save As), and nothing may
   * exit then.
   */
  async prepareToExit(verb: "quitting" | "updating"): Promise<boolean> {
    const dirtyKeys = this.order.filter((k) => this.tabs.get(k)!.dirty);
    if (dirtyKeys.length > 0) {
      const plural = dirtyKeys.length > 1;
      const names = dirtyKeys.map((k) => `"${this.tabLabel(this.tabs.get(k)!)}"`).join(", ");
      const choice = await unsavedChangesModal({
        title: "Unsaved changes",
        message: plural
          ? `You have ${dirtyKeys.length} files with unsaved changes: ${names}. Save them before ${verb}?`
          : `${names} has unsaved changes. Save it before ${verb}?`,
        saveLabel: plural ? "Save All" : "Save",
      });

      if (choice === "cancel") return false;
      if (choice === "save") {
        for (const key of dirtyKeys) {
          const saved = await this.saveTab(key);
          if (!saved) return false;
        }
      }
    }
    await this.captureWindowGeom();
    await this.flushPersist();
    return true;
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
    if (
      typeof x === "number" &&
      typeof y === "number" &&
      (await this.rectOnAnyMonitor(x, y, width ?? 0, height ?? 0))
    ) {
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
      void this.captureWindowGeom().then(() => this.persist());
    };
    win.onResized(onChange).catch(() => {});
    win.onMoved(onChange).catch(() => {});
  }

  private wireDragDrop() {
    // Emitted by Rust once it has granted the dropped paths (on_drop in
    // src-tauri/src/lib.rs), in place of Tauri's own drag-drop event.
    listen<string[]>("notes://drop", async (event) => {
      const skipped: string[] = [];
      for (const p of event.payload) {
        if (NOTE_EXT.test(p)) {
          await this.openFile(p);
        } else if (await pathIsDir(p)) {
          await this.setOpenFolder(p);
        } else {
          skipped.push(p);
        }
      }
      if (skipped.length > 0) {
        showToast(`Couldn't open ${quotedNames(skipped)}: Notes opens .txt, .md and .json files.`, "error");
      }
    }).catch(() => {});
  }

  /** Catches changes made outside the app (another editor, a sync client) by re-reading the tree whenever the window regains focus. */
  private wireFolderRefresh() {
    getCurrentWebviewWindow()
      .onFocusChanged((event) => {
        if (!event.payload) return;
        void this.refreshFolder();
        void this.reloadChangedTabs();
      })
      .catch(() => {});
  }

  themeIds() {
    return THEME_ORDER;
  }
}
