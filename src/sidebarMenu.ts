import type { App } from "./app";
import { installContextMenu, type MenuItem } from "./contextMenu";

/** `initTitlebar` sets this from Rust's `std::env::consts::OS`. */
const platform = () => document.documentElement.dataset.platform;

/** What the OS calls the place deleted files go. */
export const trashName = () => (platform() === "windows" ? "Recycle Bin" : "Trash");

function revealLabel(): string {
  if (platform() === "windows") return "Reveal in File Explorer";
  if (platform() === "macos") return "Reveal in Finder";
  return "Show in Folder";
}

function fileItems(app: App, path: string): MenuItem[] {
  return [
    { label: "Rename…", run: () => app.renameFile(path) },
    { label: "Delete…", danger: true, run: () => app.deleteFile(path) },
    { label: revealLabel(), separator: true, run: () => app.revealPath(path) },
  ];
}

function folderItems(app: App, dir: string): MenuItem[] {
  return [
    { label: "New Note…", run: () => app.newNoteInFolder(dir) },
    { label: revealLabel(), separator: true, run: () => app.revealPath(dir) },
  ];
}

/**
 * The sidebar's right-click menu: Rename, Delete and Reveal for a note, and
 * New Note and Reveal for a folder. Folders can't be renamed or deleted from
 * here; they can hold files the tree doesn't show.
 */
export function installSidebarMenu(app: App) {
  const sidebar = document.getElementById("sidebar")!;
  installContextMenu(sidebar, document.getElementById("sidebar-menu")!, (target) => {
    const loose = target.closest<HTMLElement>(".loose-row")?.querySelector<HTMLElement>("[data-file]");
    if (loose) {
      const path = loose.dataset.file!;
      return [...fileItems(app, path), { label: "Remove from Sidebar", run: () => app.closeLooseFile(path) }];
    }
    const file = target.closest<HTMLElement>("#folder-tree [data-file]");
    if (file) return fileItems(app, file.dataset.file!);
    const dir = target.closest<HTMLElement>("#folder-tree [data-dir]");
    if (dir) return folderItems(app, dir.dataset.dir!);
    if (app.openFolder && target.closest("#folder-label")) return folderItems(app, app.openFolder);
    return null;
  });
}
