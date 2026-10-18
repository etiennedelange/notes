export function basename(path: string): string {
  const norm = path.replace(/[/\\]+$/, "");
  const idx = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return idx === -1 ? norm : norm.slice(idx + 1);
}

export function dirname(path: string): string {
  const norm = path.replace(/[/\\]+$/, "");
  const idx = Math.max(norm.lastIndexOf("/"), norm.lastIndexOf("\\"));
  return idx === -1 ? "" : norm.slice(0, idx);
}

/** Joins a file name onto a folder, using the separator the folder path already uses. */
export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.replace(/[/\\]+$/, "") + sep + name;
}

/**
 * Display heuristic only: decides whether an opened file appears under the
 * folder tree vs. "Pinned Files". Case-insensitive and does not resolve `..`
 * segments, so it is not a path-containment check — never use it to decide
 * whether a path is safe to read or write. Real containment checks belong in
 * Rust, after `canonicalize`.
 */
export function isDescendant(root: string, path: string): boolean {
  const normRoot = root.replace(/[/\\]+$/, "").toLowerCase();
  const normPath = path.toLowerCase();
  return normPath.startsWith(normRoot + "/") || normPath.startsWith(normRoot + "\\");
}

/**
 * True if `path` is inside the folder `root`, matching case exactly. For
 * re-pointing or closing what was under a folder the app itself renamed or
 * deleted, where both paths come from the same tree: unlike isDescendant, a
 * sibling that differs only in case (`Work` next to `work`, on Linux) isn't
 * caught up in it. Not a security check either; see isDescendant.
 */
export function isUnder(root: string, path: string): boolean {
  const normRoot = root.replace(/[/\\]+$/, "");
  return path.startsWith(normRoot + "/") || path.startsWith(normRoot + "\\");
}

/**
 * A file name for an untitled note, taken from its first non-blank line the
 * way most editors suggest one: Markdown heading and list markers dropped,
 * characters Windows or macOS refuse in names removed, capped in length.
 * Falls back to "Untitled". Has no extension.
 */
export function suggestedFileName(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const name = first
    .replace(/^\s*(#{1,6}\s+|[-*+>]\s+|\d+[.)]\s+)?/, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim()
    .replace(/^\.+|\.+$/g, "");
  return name || "Untitled";
}
