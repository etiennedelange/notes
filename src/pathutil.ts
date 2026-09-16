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

export function isDescendant(root: string, path: string): boolean {
  const normRoot = root.replace(/[/\\]+$/, "").toLowerCase();
  const normPath = path.toLowerCase();
  return normPath.startsWith(normRoot + "/") || normPath.startsWith(normRoot + "\\");
}
