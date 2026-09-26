//! The part of Notes that has nothing to do with how it is drawn.
//!
//! Filesystem access, the consent model that gates it, atomic saves, the
//! folder walk, and session persistence all live here, behind a plain Rust
//! API that takes paths and a granted set. Nothing in this crate knows about
//! Tauri, a webview, or an IPC boundary — the UI layer supplies the consented
//! paths and the config directory, and owns how those are stored.

use serde::{Deserialize, Serialize, Serializer};
use std::collections::HashSet;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;

const IGNORED_DIRS: [&str; 6] = [
    ".git",
    "node_modules",
    ".obsidian",
    ".vscode",
    "$RECYCLE.BIN",
    "System Volume Information",
];
const MAX_TREE_ENTRIES: usize = 8000;
const MAX_TREE_DEPTH: usize = 12;
/// Notes are hand-written text; anything past this is a pasted log or a wrong
/// file, and reading it would balloon memory and stall the IPC bridge.
const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;

/// Every command failure the frontend can see. `Serialize` renders it as a
/// plain string so `${e}` in a toast still reads as a sentence rather than
/// `[object Object]`.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Not a directory: {0}")]
    NotADirectory(String),
    #[error("Refusing to write a non-note file: {0}")]
    UnsupportedFileType(String),
    #[error("{path} is too large to open ({size} bytes)")]
    TooLarge { path: String, size: u64 },
    #[error("Couldn't read {path}: {source}")]
    Read { path: String, source: io::Error },
    #[error("Couldn't save {path}: {source}")]
    Write { path: String, source: io::Error },
    #[error("Couldn't stat {path}: {source}")]
    Stat { path: String, source: io::Error },
    #[error("No mtime for {path}: {source}")]
    Mtime { path: String, source: io::Error },
    #[error("No config dir: {0}")]
    ConfigDir(String),
    #[error("Couldn't serialize app state: {0}")]
    StateFormat(serde_json::Error),
    #[error("Access to {0} was not granted")]
    AccessDenied(String),
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Resolves `path` to the canonical location it names, following symlinks.
/// A path that doesn't exist yet (a Save As target) resolves through its
/// nearest existing ancestor with the missing components re-appended, so it
/// is checked as itself rather than as the directory that contains it. A
/// `..` among the missing components can't be resolved without those
/// directories existing, so such a path resolves to nothing and is refused.
fn resolve(path: &Path) -> Option<PathBuf> {
    let mut missing = Vec::new();
    let mut cur = path;
    loop {
        if let Ok(mut resolved) = fs::canonicalize(cur) {
            for name in missing.iter().rev() {
                resolved.push(name);
            }
            return Some(resolved);
        }
        missing.push(cur.file_name()?.to_os_string());
        cur = cur.parent()?;
    }
}

fn is_permitted(granted: &HashSet<PathBuf>, candidate: &Path) -> bool {
    granted
        .iter()
        .any(|root| candidate == root || candidate.starts_with(root))
}

fn check_access(granted: &HashSet<PathBuf>, path: &str) -> Result<(), Error> {
    let resolved = resolve(Path::new(path)).ok_or_else(|| Error::AccessDenied(path.to_string()))?;
    if is_permitted(granted, &resolved) {
        Ok(())
    } else {
        Err(Error::AccessDenied(path.to_string()))
    }
}

/// Distinguishes concurrent temp files; saves are serialized by the UI today,
/// but a collision would silently cost someone a note.
static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// Writes `contents` to `path` atomically: fill a sibling temp file, flush it to
/// disk, preserve the target's permissions, rename over the target, then fsync
/// the parent directory so the rename itself is durable. `fs::write` truncates
/// first, so a crash mid-write leaves an empty note; this can only leave a
/// stray `.tmp` behind.
fn write_atomic(path: &Path, contents: &str) -> io::Result<()> {
    // Write through a symlink rather than over it: renaming onto the link
    // itself would replace it with a regular file and leave its real target
    // (a note linked in from a dotfiles repo, say) untouched.
    let resolved = fs::canonicalize(path);
    let path = resolved.as_deref().unwrap_or(path);
    let parent = match path.parent() {
        Some(p) if !p.as_os_str().is_empty() => p,
        _ => Path::new("."),
    };
    let stem = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "note".to_string());
    // Leading dot keeps the temp file out of the sidebar, which skips dotfiles.
    let tmp = parent.join(format!(
        ".{stem}.{}.tmp",
        TMP_SEQ.fetch_add(1, Ordering::Relaxed)
    ));

    let result = (|| {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
        drop(file);
        // fs::File::create resets the mode to the umask default, which would
        // silently widen (or narrow) an existing file's permissions on every
        // save. Copy the destination's permissions onto the temp file first.
        if let Ok(meta) = fs::metadata(path) {
            let _ = fs::set_permissions(&tmp, meta.permissions());
        }
        // Overwrites the destination on both Windows and POSIX.
        fs::rename(&tmp, path)?;
        // The rename isn't durable until the directory entry is flushed.
        // Unsupported on Windows, and best-effort even on Unix: a failure
        // here doesn't mean the save failed.
        #[cfg(unix)]
        {
            let _ = fs::File::open(parent).and_then(|dir| dir.sync_all());
        }
        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DirNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<DirNode>>,
    /// Only meaningful on the root node: true if MAX_TREE_ENTRIES cut the walk
    /// short, so the frontend can show that some files aren't listed.
    #[serde(default)]
    truncated: bool,
}

pub fn is_notable_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".txt") || lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn walk_dir(dir: &Path, depth: usize, budget: &mut usize, truncated: &mut bool) -> Vec<DirNode> {
    let mut entries: Vec<DirNode> = Vec::new();
    let Ok(read) = fs::read_dir(dir) else {
        return entries;
    };
    let mut items: Vec<_> = read.flatten().collect();
    // Directories first, then case-insensitive by name — matches VS Code,
    // Obsidian and Explorer, which is what every tree here gets compared to.
    items.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_is_dir
            .cmp(&a_is_dir)
            .then_with(|| a.file_name().to_string_lossy().to_lowercase().cmp(&b.file_name().to_string_lossy().to_lowercase()))
    });

    for entry in items {
        if *budget == 0 {
            *truncated = true;
            break;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            // allow dotfiles to stay invisible; this app targets plain notes
            continue;
        }
        if IGNORED_DIRS.contains(&name.as_str()) {
            continue;
        }
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_dir() {
            if depth >= MAX_TREE_DEPTH {
                continue;
            }
            // Reserve this directory's slot *before* descending: the recursive
            // call can spend the budget down to zero, and decrementing after it
            // returns would underflow (unbounded walk in release builds).
            *budget -= 1; // safe: the loop guard above guarantees budget > 0
            let children = walk_dir(&path, depth + 1, budget, truncated);
            if children.is_empty() {
                *budget += 1; // nothing relevant inside — give the slot back
                continue; // hide folders with nothing relevant inside
            }
            entries.push(DirNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children: Some(children),
                truncated: false,
            });
        } else if is_notable_file(&name) {
            *budget -= 1;
            entries.push(DirNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
                truncated: false,
            });
        }
    }

    entries
}

pub fn read_dir_tree(root: String, granted: &HashSet<PathBuf>) -> Result<DirNode, Error> {
    check_access(granted, &root)?;
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(Error::NotADirectory(root));
    }
    let mut budget = MAX_TREE_ENTRIES;
    let mut truncated = false;
    let children = walk_dir(&path, 0, &mut budget, &mut truncated);
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| root.clone());
    Ok(DirNode {
        name,
        path: root,
        is_dir: true,
        children: Some(children),
        truncated,
    })
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileResult {
    contents: String,
    /// True if the file wasn't valid UTF-8 and was decoded with replacement
    /// characters — a Notepad++ replacement meets UTF-16 and Latin-1 files
    /// often enough that this needs to degrade gracefully instead of erroring.
    lossy: bool,
}

pub fn read_text_file(path: String, granted: &HashSet<PathBuf>) -> Result<ReadFileResult, Error> {
    check_access(granted, &path)?;
    // Stat the open file handle, not a separate fs::metadata call: checking
    // the size and then reading the path again is TOCTOU — a file that grows
    // in between is read in full regardless of MAX_FILE_BYTES.
    let file = fs::File::open(&path).map_err(|source| Error::Stat {
        path: path.clone(),
        source,
    })?;
    let meta = file.metadata().map_err(|source| Error::Stat {
        path: path.clone(),
        source,
    })?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(Error::TooLarge {
            path,
            size: meta.len(),
        });
    }
    let mut bytes = Vec::new();
    file.take(MAX_FILE_BYTES)
        .read_to_end(&mut bytes)
        .map_err(|source| Error::Read {
            path: path.clone(),
            source,
        })?;
    match String::from_utf8(bytes) {
        Ok(contents) => Ok(ReadFileResult {
            contents,
            lossy: false,
        }),
        Err(e) => Ok(ReadFileResult {
            contents: String::from_utf8_lossy(&e.into_bytes()).into_owned(),
            lossy: true,
        }),
    }
}

pub fn write_text_file(
    path: String,
    contents: String,
    granted: &HashSet<PathBuf>,
) -> Result<(), Error> {
    check_access(granted, &path)?;
    // These commands take raw paths from the webview, so the only thing standing
    // between a compromised frontend and an arbitrary file overwrite is this
    // check. Keep it in sync with is_notable_file. Both the given name and
    // the resolved one must pass, or a `note.md` symlink could aim a save at
    // any other file in a granted folder.
    let is_note = |p: &Path| {
        p.file_name()
            .is_some_and(|n| is_notable_file(&n.to_string_lossy()))
    };
    let resolved = resolve(Path::new(&path));
    if !is_note(Path::new(&path)) || !resolved.as_deref().is_some_and(is_note) {
        return Err(Error::UnsupportedFileType(path));
    }
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|source| Error::Write {
                path: path.clone(),
                source,
            })?;
        }
    }
    write_atomic(Path::new(&path), &contents).map_err(|source| Error::Write {
        path: path.clone(),
        source,
    })
}

pub fn path_exists(path: &str, granted: &HashSet<PathBuf>) -> bool {
    // Collapses "doesn't exist" and "exists but not granted" into the same
    // `false`, so this can't be used to probe for the existence of paths the
    // webview was never given.
    let p = Path::new(path);
    if !p.exists() {
        return false;
    }
    match fs::canonicalize(p) {
        Ok(canon) => is_permitted(granted, &canon),
        Err(_) => false,
    }
}

pub fn path_is_dir(path: &str, granted: &HashSet<PathBuf>) -> bool {
    let p = Path::new(path);
    if !p.is_dir() {
        return false;
    }
    match fs::canonicalize(p) {
        Ok(canon) => is_permitted(granted, &canon),
        Err(_) => false,
    }
}

/// Records that the user has granted access to `path` through a real gesture
/// (a dialog pick, a drag-drop, or the app's own persisted session). Only the
/// Tauri shell calls this, from its own dialog and drop handlers: the webview
/// can't grant itself anything. A not-yet-created Save As target is recorded
/// as that exact file, not as the directory it will be created in.
pub fn grant_path_access(path: &str, granted: &mut HashSet<PathBuf>) -> Result<(), Error> {
    let resolved = resolve(Path::new(path)).ok_or_else(|| Error::AccessDenied(path.to_string()))?;
    granted.insert(resolved);
    Ok(())
}

fn is_existing_and_permitted(path: &str, granted: &HashSet<PathBuf>) -> bool {
    Path::new(path).exists() && check_access(granted, path).is_ok()
}

pub fn file_mtime_ms(path: String, granted: &HashSet<PathBuf>) -> Result<u64, Error> {
    check_access(granted, &path)?;
    let meta = fs::metadata(&path).map_err(|source| Error::Stat {
        path: path.clone(),
        source,
    })?;
    let modified = meta.modified().map_err(|source| Error::Mtime {
        path: path.clone(),
        source,
    })?;
    let ms = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| Error::Mtime {
            path,
            source: io::Error::new(io::ErrorKind::InvalidData, e),
        })?
        .as_millis() as u64;
    Ok(ms)
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AppStateDto {
    theme: Option<String>,
    zoom: Option<f64>,
    editor_zoom: Option<f64>,
    sidebar_width: Option<f64>,
    last_folder: Option<String>,
    recent_files: Vec<String>,
    open_tabs: Vec<String>,
    active_tab: Option<String>,
    pinned_tabs: Vec<String>,
    window_x: Option<f64>,
    window_y: Option<f64>,
    window_width: Option<f64>,
    window_height: Option<f64>,
    window_maximized: Option<bool>,
}

impl AppStateDto {
    /// Re-grants the paths an earlier session had open. Only paths that still
    /// exist are granted: a deleted note must not turn into a grant on the
    /// folder that used to hold it.
    fn grant_remembered_paths(&self, granted: &mut HashSet<PathBuf>) {
        let remembered = self
            .last_folder
            .iter()
            .chain(&self.open_tabs)
            .chain(&self.recent_files);
        for path in remembered {
            if Path::new(path).exists() {
                let _ = grant_path_access(path, granted);
            }
        }
    }

    /// Drops every path this run wasn't granted. Persisted paths are re-granted
    /// at the next launch, so without this a compromised webview could write
    /// an arbitrary path into the state file and have it trusted on restart.
    fn retain_permitted(&mut self, granted: &HashSet<PathBuf>) {
        let ok = |p: &String| is_existing_and_permitted(p, granted);
        self.last_folder = self.last_folder.take().filter(ok);
        self.active_tab = self.active_tab.take().filter(ok);
        self.recent_files.retain(ok);
        self.open_tabs.retain(ok);
        self.pinned_tabs.retain(ok);
    }
}

/// Ensures `config_dir` exists and returns the state file inside it. The
/// caller supplies the directory, so persistence doesn't depend on any UI
/// toolkit's idea of where an app keeps its config.
pub fn state_path(config_dir: &Path) -> Result<PathBuf, Error> {
    if !config_dir.exists() {
        fs::create_dir_all(config_dir).map_err(|source| Error::Write {
            path: config_dir.to_string_lossy().to_string(),
            source,
        })?;
    }
    Ok(config_dir.join("state.json"))
}

/// Loads the persisted session and grants the paths it remembers.
pub fn load_state(config_dir: &Path, granted: &mut HashSet<PathBuf>) -> Result<AppStateDto, Error> {
    let state = read_state(config_dir)?;
    state.grant_remembered_paths(granted);
    Ok(state)
}

fn read_state(config_dir: &Path) -> Result<AppStateDto, Error> {
    let path = state_path(config_dir)?;
    if !path.exists() {
        return Ok(AppStateDto::default());
    }
    let raw = fs::read_to_string(&path).map_err(|source| Error::Read {
        path: path.to_string_lossy().to_string(),
        source,
    })?;
    match serde_json::from_str(&raw) {
        Ok(state) => Ok(state),
        Err(_) => {
            // A malformed state file used to wipe the session with no trace.
            // Set it aside so it's recoverable and start from defaults. The
            // timestamp keeps a second bad file from overwriting the first.
            let stamp = std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_or(0, |d| d.as_secs());
            let _ = fs::rename(&path, path.with_extension(format!("json.{stamp}.bak")));
            Ok(AppStateDto::default())
        }
    }
}

pub fn save_state(
    config_dir: &Path,
    mut state: AppStateDto,
    granted: &HashSet<PathBuf>,
) -> Result<(), Error> {
    state.retain_permitted(granted);
    let path = state_path(config_dir)?;
    let raw = serde_json::to_string_pretty(&state).map_err(Error::StateFormat)?;
    write_atomic(&path, &raw).map_err(|source| Error::Write {
        path: path.to_string_lossy().to_string(),
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Creates a uniquely-named scratch directory that is removed on drop.
    struct TempTree(PathBuf);

    impl TempTree {
        fn new(tag: &str) -> Self {
            // Two concurrent `cargo test` runs (or a stale directory from a
            // prior crash) would otherwise collide on the same fixed path.
            let dir =
                std::env::temp_dir().join(format!("notes_test_{tag}_{}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).expect("create temp tree");
            TempTree(dir)
        }

        fn file(&self, rel: &str) -> &Self {
            let path = self.0.join(rel);
            fs::create_dir_all(path.parent().unwrap()).expect("create parent");
            fs::write(&path, "note body").expect("write file");
            self
        }

        /// A granted set containing this tree's canonical root, as if the user
        /// had opened it via a dialog, drag-drop, or a folder pick.
        fn granted(&self) -> HashSet<PathBuf> {
            HashSet::from([fs::canonicalize(&self.0).expect("canonicalize temp tree")])
        }
    }

    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn count_nodes(nodes: &[DirNode]) -> usize {
        nodes
            .iter()
            .map(|n| 1 + n.children.as_deref().map_or(0, count_nodes))
            .sum()
    }

    fn walk(dir: &Path, budget: &mut usize) -> Vec<DirNode> {
        let mut truncated = false;
        walk_dir(dir, 0, budget, &mut truncated)
    }

    /// Regression: the directory branch used to decrement the budget *after*
    /// recursing, so a child that spent the last slot left the parent
    /// subtracting from zero — a panic in debug, and a wrap to usize::MAX in
    /// release that silently removed the MAX_TREE_ENTRIES cap entirely.
    #[test]
    fn nested_dir_does_not_underflow_exhausted_budget() {
        let tree = TempTree::new("underflow");
        tree.file("subdir/a.md").file("subdir/b.md");

        // One slot cannot hold both the folder and a child, and a folder with no
        // visible children is hidden by design — so the tree comes back empty,
        // with the slot refunded rather than the counter wrapping.
        let mut budget = 1usize;
        let out = walk(&tree.0, &mut budget);

        assert_eq!(budget, 1, "the hidden folder should have refunded its slot");
        assert_eq!(count_nodes(&out), 0);

        // Two slots are enough for the folder plus its first child.
        let mut budget = 2usize;
        let out = walk(&tree.0, &mut budget);

        assert_eq!(budget, 0, "both slots should be spent, not wrapped");
        assert_eq!(count_nodes(&out), 2, "folder + one file");
        assert_eq!(out[0].children.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn budget_caps_total_entries() {
        let tree = TempTree::new("cap");
        for i in 0..10 {
            tree.file(&format!("d{i}/note.md"));
        }

        let mut budget = 7usize;
        let out = walk(&tree.0, &mut budget);

        assert!(count_nodes(&out) <= 7, "cap exceeded: {}", count_nodes(&out));
        assert!(budget <= 7, "budget wrapped around: {budget}");
    }

    #[test]
    fn directories_without_notes_refund_their_slot() {
        let tree = TempTree::new("refund");
        tree.file("empty/ignore.bin").file("real.md");

        let mut budget = 10usize;
        let out = walk(&tree.0, &mut budget);

        assert_eq!(count_nodes(&out), 1, "only real.md should survive");
        assert_eq!(budget, 9, "the hidden folder should not consume a slot");
    }

    #[test]
    fn deeply_nested_tree_stays_within_budget() {
        let tree = TempTree::new("deep");
        let deep = (0..MAX_TREE_DEPTH + 4)
            .map(|i| format!("d{i}"))
            .collect::<Vec<_>>()
            .join("/");
        tree.file(&format!("{deep}/note.md"));

        let mut budget = 3usize;
        let out = walk(&tree.0, &mut budget);

        assert!(budget <= 3, "budget wrapped around: {budget}");
        assert!(count_nodes(&out) <= 3);
    }

    #[test]
    fn write_text_file_rejects_non_note_extensions() {
        let tree = TempTree::new("write_guard");
        let target = tree.0.join("payload.bat");

        let err = write_text_file(target.to_string_lossy().to_string(), "echo".into(), &tree.granted())
            .expect_err("should refuse a non-note extension");

        assert!(
            err.to_string().contains("Refusing to write"),
            "unexpected error: {err}"
        );
        assert!(!target.exists(), "file must not be created");
    }

    #[test]
    fn write_text_file_accepts_note_extensions() {
        let tree = TempTree::new("write_ok");
        let target = tree.0.join("nested/note.md");

        write_text_file(target.to_string_lossy().to_string(), "hello".into(), &tree.granted())
            .expect("should write a .md file");

        assert_eq!(fs::read_to_string(&target).unwrap(), "hello");
    }

    #[test]
    fn write_text_file_rejects_paths_outside_the_granted_set() {
        let tree = TempTree::new("write_denied");
        let target = tree.0.join("note.md");

        let err = write_text_file(target.to_string_lossy().to_string(), "hello".into(), &HashSet::new())
            .expect_err("should refuse an ungranted path");

        assert!(
            err.to_string().contains("was not granted"),
            "unexpected error: {err}"
        );
        assert!(!target.exists(), "file must not be created");
    }

    #[test]
    fn write_atomic_replaces_existing_content() {
        let tree = TempTree::new("atomic_replace");
        let target = tree.0.join("note.md");
        fs::write(&target, "old contents, longer than the new one").unwrap();

        write_atomic(&target, "new").expect("overwrite");

        assert_eq!(fs::read_to_string(&target).unwrap(), "new");
    }

    /// A note the user had `chmod 600` must not become world-readable the
    /// first time they press Ctrl+S: `fs::File::create` resets the mode to the
    /// umask default, so the target's existing permissions must be copied
    /// onto the temp file before the rename replaces it.
    #[test]
    #[cfg(unix)]
    fn write_atomic_preserves_existing_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let tree = TempTree::new("atomic_perms");
        let target = tree.0.join("secret.md");
        fs::write(&target, "old").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o600)).unwrap();

        write_atomic(&target, "new").expect("overwrite");

        let mode = fs::metadata(&target).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "permissions should survive the save");
    }

    /// The temp file is a sibling of the target, so it must not survive a
    /// successful write or it would clutter the user's notes folder.
    #[test]
    fn write_atomic_leaves_no_temp_file_behind() {
        let tree = TempTree::new("atomic_clean");
        let target = tree.0.join("note.md");

        write_atomic(&target, "body").expect("write");

        let leftovers: Vec<_> = fs::read_dir(&tree.0)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|n| n != "note.md")
            .collect();
        assert!(leftovers.is_empty(), "stray files: {leftovers:?}");
    }

    /// Temp files are dot-prefixed specifically so an interrupted save can't
    /// show up in the sidebar.
    #[test]
    fn walk_dir_hides_stray_temp_files() {
        let tree = TempTree::new("tmp_hidden");
        tree.file("note.md").file(".note.md.0.tmp");

        let mut budget = 10usize;
        let out = walk(&tree.0, &mut budget);

        assert_eq!(count_nodes(&out), 1);
        assert_eq!(out[0].name, "note.md");
    }

    #[test]
    fn walk_dir_lists_directories_before_files_case_insensitively() {
        let tree = TempTree::new("sort");
        tree.file("zebra.md")
            .file("Apple.md")
            .file("Zdir/inside.md")
            .file("adir/inside.md");

        let mut budget = 20usize;
        let out = walk(&tree.0, &mut budget);

        let names: Vec<&str> = out.iter().map(|n| n.name.as_str()).collect();
        assert_eq!(names, vec!["adir", "Zdir", "Apple.md", "zebra.md"]);
    }

    #[test]
    fn walk_dir_reports_truncation_when_budget_runs_out() {
        let tree = TempTree::new("truncated");
        tree.file("a.md").file("b.md").file("c.md");

        let mut budget = 2usize;
        let mut truncated = false;
        let out = walk_dir(&tree.0, 0, &mut budget, &mut truncated);

        assert_eq!(count_nodes(&out), 2);
        assert!(truncated, "budget ran out, so truncated should be set");
    }

    #[test]
    fn walk_dir_does_not_report_truncation_when_everything_fits() {
        let tree = TempTree::new("not_truncated");
        tree.file("a.md").file("b.md");

        let mut budget = 10usize;
        let mut truncated = false;
        let out = walk_dir(&tree.0, 0, &mut budget, &mut truncated);

        assert_eq!(count_nodes(&out), 2);
        assert!(!truncated);
    }

    #[test]
    fn read_text_file_rejects_oversized_files() {
        let tree = TempTree::new("too_large");
        let target = tree.0.join("huge.md");
        let f = fs::File::create(&target).unwrap();
        f.set_len(MAX_FILE_BYTES + 1).unwrap();
        drop(f);

        let err = read_text_file(target.to_string_lossy().to_string(), &tree.granted())
            .expect_err("should refuse an oversized file");

        assert!(err.to_string().contains("too large"), "got: {err}");
    }

    #[test]
    fn read_text_file_rejects_paths_outside_the_granted_set() {
        let tree = TempTree::new("read_denied");
        tree.file("secret.md");
        let target = tree.0.join("secret.md");

        let err = read_text_file(target.to_string_lossy().to_string(), &HashSet::new())
            .expect_err("should refuse an ungranted path");

        assert!(err.to_string().contains("was not granted"), "got: {err}");
    }

    #[test]
    fn read_text_file_reads_descendants_of_a_granted_folder() {
        let tree = TempTree::new("read_descendant");
        tree.file("notes/todo.md");
        let target = tree.0.join("notes/todo.md");

        let result = read_text_file(target.to_string_lossy().to_string(), &tree.granted())
            .expect("descendant of a granted root should be readable");

        assert_eq!(result.contents, "note body");
        assert!(!result.lossy);
    }

    #[test]
    fn read_text_file_decodes_non_utf8_lossily_instead_of_erroring() {
        let tree = TempTree::new("read_lossy");
        let target = tree.0.join("latin1.md");
        fs::write(&target, [b'h', b'i', 0xFF, 0xFE]).unwrap();

        let result = read_text_file(target.to_string_lossy().to_string(), &tree.granted())
            .expect("non-UTF-8 files should decode lossily, not error");

        assert!(result.lossy);
        assert!(result.contents.starts_with("hi"));
    }

    /// A Save As target grants that one file, not the folder it lands in —
    /// otherwise saving a note into your home directory would open all of it.
    #[test]
    fn granting_a_new_file_grants_only_that_file() {
        let tree = TempTree::new("grant");
        tree.file("sibling.md");
        let mut granted = HashSet::new();
        let target = tree.0.join("Untitled.md");

        grant_path_access(&target.to_string_lossy(), &mut granted).expect("grant");

        write_text_file(target.to_string_lossy().to_string(), "new".into(), &granted)
            .expect("the granted target should be writable");
        let sibling = tree.0.join("sibling.md").to_string_lossy().to_string();
        assert!(read_text_file(sibling, &granted).is_err(), "the sibling must stay off-limits");
    }

    #[test]
    fn missing_paths_with_parent_components_are_refused() {
        let tree = TempTree::new("dotdot");
        let sneaky = tree.0.join("missing/../../escape.md");

        assert!(check_access(&tree.granted(), &sneaky.to_string_lossy()).is_err());
    }

    #[test]
    #[cfg(unix)]
    fn write_atomic_writes_through_symlinks() {
        let tree = TempTree::new("atomic_symlink");
        tree.file("real.md");
        let link = tree.0.join("link.md");
        std::os::unix::fs::symlink(tree.0.join("real.md"), &link).unwrap();

        write_atomic(&link, "new").expect("write via link");

        assert!(fs::symlink_metadata(&link).unwrap().file_type().is_symlink());
        assert_eq!(fs::read_to_string(tree.0.join("real.md")).unwrap(), "new");
    }

    #[test]
    fn state_file_missing_list_fields_still_loads() {
        let tree = TempTree::new("state_partial");
        fs::write(tree.0.join("state.json"), r#"{"theme":"nord"}"#).unwrap();

        let state = read_state(&tree.0).expect("load");

        assert_eq!(state.theme.as_deref(), Some("nord"));
        assert!(tree.0.join("state.json").exists(), "a valid file must not be set aside");
    }

    #[test]
    fn saved_state_drops_paths_that_were_never_granted() {
        let config = TempTree::new("state_config");
        let notes = TempTree::new("state_notes");
        notes.file("mine.md").file("other/theirs.md");
        let mine = notes.0.join("mine.md").to_string_lossy().to_string();
        let theirs = notes.0.join("other/theirs.md").to_string_lossy().to_string();
        let mut granted = HashSet::new();
        grant_path_access(&mine, &mut granted).unwrap();

        let state = AppStateDto {
            recent_files: vec![mine.clone(), theirs.clone()],
            open_tabs: vec![theirs.clone()],
            last_folder: Some(notes.0.to_string_lossy().to_string()),
            ..Default::default()
        };
        save_state(&config.0, state, &granted).expect("save");

        let saved = read_state(&config.0).unwrap();
        assert_eq!(saved.recent_files, vec![mine]);
        assert!(saved.open_tabs.is_empty());
        assert_eq!(saved.last_folder, None);
    }

    #[test]
    fn loading_state_regrants_only_paths_that_still_exist() {
        let config = TempTree::new("regrant_config");
        let notes = TempTree::new("regrant_notes");
        notes.file("kept.md");
        let kept = notes.0.join("kept.md").to_string_lossy().to_string();
        let gone = notes.0.join("gone/deleted.md").to_string_lossy().to_string();
        let raw = serde_json::json!({ "recentFiles": [kept.clone(), gone] }).to_string();
        fs::write(config.0.join("state.json"), raw).unwrap();

        let mut granted = HashSet::new();
        load_state(&config.0, &mut granted).expect("load");

        assert!(read_text_file(kept, &granted).is_ok());
        assert_eq!(granted.len(), 1, "a deleted note must not grant its folder");
    }

    /// Errors cross the IPC boundary as plain strings, so `${e}` in a toast
    /// stays readable instead of rendering as [object Object].
    #[test]
    fn errors_serialize_as_human_readable_strings() {
        let err = Error::NotADirectory("C:\\tmp\\nope".into());
        let json = serde_json::to_string(&err).unwrap();

        assert_eq!(json, "\"Not a directory: C:\\\\tmp\\\\nope\"");
    }
}
