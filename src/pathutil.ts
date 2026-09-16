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
