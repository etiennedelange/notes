//! Port of `src/pathutil.ts`. TODO(unit 1): port edge cases and tests.

pub fn basename(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}

pub fn dirname(path: &str) -> &str {
    match path.rfind(['/', '\\']) {
        Some(i) => &path[..i],
        None => "",
    }
}

/// Display-only: case-insensitive prefix check. Never use for access control
/// — notes-core's consent check is the real gate.
pub fn is_descendant(root: &str, path: &str) -> bool {
    path.to_lowercase().starts_with(&root.to_lowercase())
}
