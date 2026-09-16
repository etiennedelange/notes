use serde::{Deserialize, Serialize, Serializer};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;
use tauri::Manager;

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
enum Error {
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
    ConfigDir(tauri::Error),
    #[error("Couldn't serialize app state: {0}")]
    StateFormat(serde_json::Error),
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// Distinguishes concurrent temp files; saves are serialized by the UI today,
/// but a collision would silently cost someone a note.
static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// Writes `contents` to `path` atomically: fill a sibling temp file, flush it to
/// disk, then rename over the target. `fs::write` truncates first, so a crash
/// mid-write leaves an empty note; this can only leave a stray `.tmp` behind.
fn write_atomic(path: &Path, contents: &str) -> io::Result<()> {
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
        // Overwrites the destination on both Windows and POSIX.
        fs::rename(&tmp, path)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DirNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<DirNode>>,
}

fn is_notable_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".txt") || lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn walk_dir(dir: &Path, depth: usize, budget: &mut usize) -> Vec<DirNode> {
    let mut entries: Vec<DirNode> = Vec::new();
    let Ok(read) = fs::read_dir(dir) else {
        return entries;
    };
    let mut items: Vec<_> = read.flatten().collect();
    items.sort_by_key(|e| e.file_name());

    for entry in items {
        if *budget == 0 {
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
            let children = walk_dir(&path, depth + 1, budget);
            if children.is_empty() {
                *budget += 1; // nothing relevant inside — give the slot back
                continue; // hide folders with nothing relevant inside
            }
            entries.push(DirNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children: Some(children),
            });
        } else if is_notable_file(&name) {
            *budget -= 1;
            entries.push(DirNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }

    entries
}

// The filesystem commands below are all marked `async` so Tauri runs them on
// the async runtime instead of the main thread. They do blocking std::fs work,
// and a slow disk or network share would otherwise freeze the window — including
// the custom titlebar and its drag region.
#[tauri::command(async)]
fn read_dir_tree(root: String) -> Result<DirNode, Error> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(Error::NotADirectory(root));
    }
    let mut budget = MAX_TREE_ENTRIES;
    let children = walk_dir(&path, 0, &mut budget);
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| root.clone());
    Ok(DirNode {
        name,
        path: root,
        is_dir: true,
        children: Some(children),
    })
}

#[tauri::command(async)]
fn read_text_file(path: String) -> Result<String, Error> {
    let meta = fs::metadata(&path).map_err(|source| Error::Stat {
        path: path.clone(),
        source,
    })?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(Error::TooLarge {
            path,
            size: meta.len(),
        });
    }
    fs::read_to_string(&path).map_err(|source| Error::Read {
        path: path.clone(),
        source,
    })
}

#[tauri::command(async)]
fn write_text_file(path: String, contents: String) -> Result<(), Error> {
    // These commands take raw paths from the webview, so the only thing standing
    // between a compromised frontend and an arbitrary file overwrite is this
    // check. Keep it in sync with is_notable_file.
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    if !is_notable_file(&name) {
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

#[tauri::command(async)]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command(async)]
fn file_mtime_ms(path: String) -> Result<u64, Error> {
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
#[serde(rename_all = "camelCase")]
struct AppStateDto {
    theme: Option<String>,
    last_folder: Option<String>,
    recent_files: Vec<String>,
    open_tabs: Vec<String>,
    active_tab: Option<String>,
}

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, Error> {
    let dir = app.path().app_config_dir().map_err(Error::ConfigDir)?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|source| Error::Write {
            path: dir.to_string_lossy().to_string(),
            source,
        })?;
    }
    Ok(dir.join("state.json"))
}

#[tauri::command(async)]
fn load_state(app: tauri::AppHandle) -> Result<AppStateDto, Error> {
    let path = state_path(&app)?;
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
            // Set it aside so it's recoverable and start from defaults.
            let _ = fs::rename(&path, path.with_extension("json.bak"));
            Ok(AppStateDto::default())
        }
    }
}

#[tauri::command(async)]
fn save_state(app: tauri::AppHandle, state: AppStateDto) -> Result<(), Error> {
    let path = state_path(&app)?;
    let raw = serde_json::to_string_pretty(&state).map_err(Error::StateFormat)?;
    write_atomic(&path, &raw).map_err(|source| Error::Write {
        path: path.to_string_lossy().to_string(),
        source,
    })
}

#[tauri::command]
fn platform_name() -> &'static str {
    std::env::consts::OS
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_dir_tree,
            read_text_file,
            write_text_file,
            path_exists,
            file_mtime_ms,
            load_state,
            save_state,
            platform_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Creates a uniquely-named scratch directory that is removed on drop.
    struct TempTree(PathBuf);

    impl TempTree {
        fn new(tag: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("notes_test_{tag}"));
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
        let out = walk_dir(&tree.0, 0, &mut budget);

        assert_eq!(budget, 1, "the hidden folder should have refunded its slot");
        assert_eq!(count_nodes(&out), 0);

        // Two slots are enough for the folder plus its first child.
        let mut budget = 2usize;
        let out = walk_dir(&tree.0, 0, &mut budget);

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
        let out = walk_dir(&tree.0, 0, &mut budget);

        assert!(count_nodes(&out) <= 7, "cap exceeded: {}", count_nodes(&out));
        assert!(budget <= 7, "budget wrapped around: {budget}");
    }

    #[test]
    fn directories_without_notes_refund_their_slot() {
        let tree = TempTree::new("refund");
        tree.file("empty/ignore.bin").file("real.md");

        let mut budget = 10usize;
        let out = walk_dir(&tree.0, 0, &mut budget);

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
        let out = walk_dir(&tree.0, 0, &mut budget);

        assert!(budget <= 3, "budget wrapped around: {budget}");
        assert!(count_nodes(&out) <= 3);
    }

    #[test]
    fn write_text_file_rejects_non_note_extensions() {
        let tree = TempTree::new("write_guard");
        let target = tree.0.join("payload.bat");

        let err = write_text_file(target.to_string_lossy().to_string(), "echo".into())
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

        write_text_file(target.to_string_lossy().to_string(), "hello".into())
            .expect("should write a .md file");

        assert_eq!(fs::read_to_string(&target).unwrap(), "hello");
    }

    #[test]
    fn write_atomic_replaces_existing_content() {
        let tree = TempTree::new("atomic_replace");
        let target = tree.0.join("note.md");
        fs::write(&target, "old contents, longer than the new one").unwrap();

        write_atomic(&target, "new").expect("overwrite");

        assert_eq!(fs::read_to_string(&target).unwrap(), "new");
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
        let out = walk_dir(&tree.0, 0, &mut budget);

        assert_eq!(count_nodes(&out), 1);
        assert_eq!(out[0].name, "note.md");
    }

    #[test]
    fn read_text_file_rejects_oversized_files() {
        let tree = TempTree::new("too_large");
        let target = tree.0.join("huge.md");
        let f = fs::File::create(&target).unwrap();
        f.set_len(MAX_FILE_BYTES + 1).unwrap();
        drop(f);

        let err = read_text_file(target.to_string_lossy().to_string())
            .expect_err("should refuse an oversized file");

        assert!(err.to_string().contains("too large"), "got: {err}");
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
