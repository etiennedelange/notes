import type { App } from "./app";
import { installContextMenu, type MenuItem } from "./contextMenu";
import type { FolderContents } from "./fs";

/** `initTitlebar` sets this from Rust's `std::env::consts::OS`. */
const platform = () => document.documentElement.dataset.platform;

/** What the OS calls the place deleted files go. */
export const trashName = () => (platform() === "windows" ? "Recycle Bin" : "Trash");

/** ", with 3 notes and 2 other files in it" for the delete-folder confirmation. */
export function folderContentsPhrase(c: FolderContents): string {
  const n = (count: number, one: string, many: string) =>
    `${count}${c.truncated ? "+" : ""} ${count === 1 ? one : many}`;
  const parts = [
    ...(c.notes > 0 ? [n(c.notes, "note", "notes")] : []),
    ...(c.otherFiles > 0 ? [n(c.otherFiles, "other file", "other files")] : []),
  ];
  if (parts.length === 0) return "";
  return `, with ${parts.join(" and ")} in it`;
}

/** What the OS file manager's "show this file" command is called. */
export function revealLabel(): string {
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
    { label: "Rename…", separator: true, run: () => app.renameFolder(dir) },
    { label: "Delete…", danger: true, run: () => app.deleteFolder(dir) },
    { label: revealLabel(), separator: true, run: () => app.revealPath(dir) },
  ];
}

/** The open folder itself can't be renamed or deleted from inside it (see `check_subfolder` in Rust). */
function rootFolderItems(app: App, dir: string): MenuItem[] {
  return [
    { label: "New Note…", run: () => app.newNoteInFolder(dir) },
    { label: revealLabel(), separator: true, run: () => app.revealPath(dir) },
  ];
}

/**
 * The sidebar's right-click menu: Rename, Delete and Reveal for a note, and
 * New Note, Rename, Delete and Reveal for a folder inside the open folder.
 * The open folder itself gets New Note and Reveal only.
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
    if (app.openFolder && target.closest("#folder-label")) return rootFolderItems(app, app.openFolder);
    return null;
  });
}
