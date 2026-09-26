//! The Tauri shell around [`notes_core`]: the consent store, the IPC surface
//! the webview calls, and the app entry point. Everything that actually
//! touches the filesystem lives in the core crate; this file only translates
//! between Tauri's world (managed state, `AppHandle`) and plain Rust values.

use notes_core::{AppStateDto, DirNode, Error, ReadFileResult};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use tauri::{DragDropEvent, Emitter, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_dialog::{DialogExt, FilePath, FileDialogBuilder};

/// Paths the user has granted access to this run: dialog picks, drag-drop
/// payloads, and the app's own persisted state restored at startup.
/// Filesystem commands below check the requested path against this set (or
/// its descendants) before touching disk. Grants are only ever recorded here
/// in Rust — by the dialog commands, the drop handler and `load_state` — and
/// no command lets the webview add one, so a future XSS or malicious
/// dependency can't name an arbitrary path: it can only reach what a real
/// user gesture already opened. `PRODUCT.md` rules out a vault, so this
/// scopes to consent rather than to the open folder.
struct ConsentedPaths(Mutex<HashSet<PathBuf>>);

impl ConsentedPaths {
    /// A panic while the lock was held can't leave the set half-updated in a
    /// way that matters, so recover from poisoning rather than failing every
    /// filesystem command for the rest of the run.
    fn lock(&self) -> MutexGuard<'_, HashSet<PathBuf>> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Emitted to the webview with the dropped paths once they have been granted.
const DROP_EVENT: &str = "notes://drop";

/// Where the session state file lives. The core crate takes this as an
/// argument rather than resolving it, so it doesn't depend on Tauri's notion
/// of an app config directory.
fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, Error> {
    app.path()
        .app_config_dir()
        .map_err(|e| Error::ConfigDir(e.to_string()))
}

// The filesystem commands below are all marked `async` so Tauri runs them on
// the async runtime instead of the main thread. They do blocking std::fs work;
// at this app's scale that's fine, and it keeps the custom titlebar and its
// drag region responsive. If this ever needs to walk a slow network share,
// `tauri::async_runtime::spawn_blocking` — not a synchronous command — is the
// correct tool, since these still run on shared Tokio worker threads.

#[tauri::command(async)]
fn read_dir_tree(root: String, state: tauri::State<ConsentedPaths>) -> Result<DirNode, Error> {
    // Walk a snapshot: holding the lock for a large folder would stall every
    // save and read queued behind it.
    let granted = state.lock().clone();
    notes_core::read_dir_tree(root, &granted)
}

#[tauri::command(async)]
fn read_text_file(
    path: String,
    state: tauri::State<ConsentedPaths>,
) -> Result<ReadFileResult, Error> {
    notes_core::read_text_file(path, &state.lock())
}

#[tauri::command(async)]
fn write_text_file(
    path: String,
    contents: String,
    state: tauri::State<ConsentedPaths>,
) -> Result<(), Error> {
    notes_core::write_text_file(path, contents, &state.lock())
}

#[tauri::command(async)]
fn path_exists(path: String, state: tauri::State<ConsentedPaths>) -> bool {
    notes_core::path_exists(&path, &state.lock())
}

#[tauri::command(async)]
fn path_is_dir(path: String, state: tauri::State<ConsentedPaths>) -> bool {
    notes_core::path_is_dir(&path, &state.lock())
}

#[tauri::command(async)]
fn file_mtime_ms(path: String, state: tauri::State<ConsentedPaths>) -> Result<u64, Error> {
    notes_core::file_mtime_ms(path, &state.lock())
}

#[tauri::command(async)]
fn load_state(
    app: tauri::AppHandle,
    state: tauri::State<ConsentedPaths>,
) -> Result<AppStateDto, Error> {
    notes_core::load_state(&config_dir(&app)?, &mut state.lock())
}

#[tauri::command(async)]
fn save_state(
    app: tauri::AppHandle,
    persisted: AppStateDto,
    state: tauri::State<ConsentedPaths>,
) -> Result<(), Error> {
    notes_core::save_state(&config_dir(&app)?, persisted, &state.lock())
}

// Dialogs run in Rust rather than through the dialog plugin's JS API, so the
// path that comes back is granted here, on the strength of the user actually
// picking it — never on the webview's say-so. The blocking variants are safe
// in async commands, which run off the main thread.

fn dialog(window: &WebviewWindow) -> FileDialogBuilder<tauri::Wry> {
    window.dialog().file().set_parent(window)
}

/// Grants a picked path and hands it back as a string, or `None` if the
/// dialog was cancelled or returned something that isn't a local path.
fn grant_pick(picked: Option<FilePath>, state: &ConsentedPaths) -> Option<String> {
    let path = picked?.into_path().ok()?.to_string_lossy().into_owned();
    notes_core::grant_path_access(&path, &mut state.lock()).ok()?;
    Some(path)
}

#[tauri::command(async)]
fn pick_folder(window: WebviewWindow, state: tauri::State<ConsentedPaths>) -> Option<String> {
    grant_pick(dialog(&window).blocking_pick_folder(), &state)
}

#[tauri::command(async)]
fn pick_note_file(window: WebviewWindow, state: tauri::State<ConsentedPaths>) -> Option<String> {
    let picked = dialog(&window)
        .add_filter("Notes", &["txt", "md", "markdown"])
        .blocking_pick_file();
    grant_pick(picked, &state)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveTarget {
    path: String,
    /// True if `.md` was appended to the picked name. The dialog only
    /// confirmed overwriting the name as typed, so the webview must confirm
    /// separately if the appended one already exists.
    extension_added: bool,
}

#[tauri::command(async)]
fn pick_save_path(
    window: WebviewWindow,
    default_path: String,
    state: tauri::State<ConsentedPaths>,
) -> Option<SaveTarget> {
    let default_path = Path::new(&default_path);
    let mut builder = dialog(&window)
        .add_filter("Markdown", &["md"])
        .add_filter("Text", &["txt"]);
    if let Some(name) = default_path.file_name() {
        builder = builder.set_file_name(name.to_string_lossy());
    }
    if let Some(dir) = default_path.parent().filter(|d| d.is_absolute()) {
        builder = builder.set_directory(dir);
    }
    let picked = builder.blocking_save_file()?.into_path().ok()?;
    let picked = picked.to_string_lossy();
    // Not every platform's save dialog appends the filter's extension (GTK
    // notably doesn't), and write_text_file refuses non-note files.
    let extension_added = !notes_core::is_notable_file(&picked);
    let path = if extension_added {
        format!("{picked}.md")
    } else {
        picked.into_owned()
    };
    notes_core::grant_path_access(&path, &mut state.lock()).ok()?;
    Some(SaveTarget {
        path,
        extension_added,
    })
}

#[tauri::command]
fn platform_name() -> &'static str {
    std::env::consts::OS
}

/// Grants every dropped path, then tells the webview which ones it may open.
/// The webview listens for this instead of Tauri's own drag-drop event, so a
/// path only reaches it after the grant exists.
fn on_drop(window: &tauri::Window, paths: &[PathBuf]) {
    let granted: Vec<String> = {
        let state = window.state::<ConsentedPaths>();
        let mut consented = state.lock();
        paths
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .filter(|p| notes_core::grant_path_access(p, &mut consented).is_ok())
            .collect()
    };
    let _ = window.emit(DROP_EVENT, granted);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ConsentedPaths(Mutex::new(HashSet::new())))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                on_drop(window, paths);
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_dir_tree,
            read_text_file,
            write_text_file,
            path_exists,
            path_is_dir,
            file_mtime_ms,
            load_state,
            save_state,
            pick_folder,
            pick_note_file,
            pick_save_path,
            platform_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
