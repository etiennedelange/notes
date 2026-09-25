//! The Tauri shell around [`notes_core`]: the consent store, the IPC surface
//! the webview calls, and the app entry point. Everything that actually
//! touches the filesystem lives in the core crate; this file only translates
//! between Tauri's world (managed state, `AppHandle`) and plain Rust values.

use notes_core::{AppStateDto, DirNode, Error, ReadFileResult};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// Paths the webview has actually been granted access to this run: dialog
/// results, drag-drop payloads, folder roots, and the app's own persisted
/// state restored at startup. Filesystem commands below check the requested
/// path against this set (or its descendants) before touching disk, so a
/// future XSS or malicious dependency can't name an arbitrary path — it can
/// only reach what a real user gesture already opened. `PRODUCT.md` rules out
/// a vault, so this scopes to consent rather than to the open folder.
struct ConsentedPaths(Mutex<HashSet<PathBuf>>);

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
    notes_core::read_dir_tree(root, &state.0.lock().unwrap())
}

#[tauri::command(async)]
fn read_text_file(
    path: String,
    state: tauri::State<ConsentedPaths>,
) -> Result<ReadFileResult, Error> {
    notes_core::read_text_file(path, &state.0.lock().unwrap())
}

#[tauri::command(async)]
fn write_text_file(
    path: String,
    contents: String,
    state: tauri::State<ConsentedPaths>,
) -> Result<(), Error> {
    notes_core::write_text_file(path, contents, &state.0.lock().unwrap())
}

#[tauri::command(async)]
fn path_exists(path: String, state: tauri::State<ConsentedPaths>) -> bool {
    notes_core::path_exists(&path, &state.0.lock().unwrap())
}

#[tauri::command(async)]
fn path_is_dir(path: String, state: tauri::State<ConsentedPaths>) -> bool {
    notes_core::path_is_dir(&path, &state.0.lock().unwrap())
}

#[tauri::command(async)]
fn grant_path_access(path: String, state: tauri::State<ConsentedPaths>) -> Result<(), Error> {
    notes_core::grant_path_access(&path, &mut state.0.lock().unwrap())
}

#[tauri::command(async)]
fn file_mtime_ms(path: String, state: tauri::State<ConsentedPaths>) -> Result<u64, Error> {
    notes_core::file_mtime_ms(path, &state.0.lock().unwrap())
}

#[tauri::command(async)]
fn load_state(app: tauri::AppHandle) -> Result<AppStateDto, Error> {
    notes_core::load_state(&config_dir(&app)?)
}

#[tauri::command(async)]
fn save_state(app: tauri::AppHandle, state: AppStateDto) -> Result<(), Error> {
    notes_core::save_state(&config_dir(&app)?, state)
}

#[tauri::command]
fn platform_name() -> &'static str {
    std::env::consts::OS
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ConsentedPaths(Mutex::new(HashSet::new())))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            read_dir_tree,
            read_text_file,
            write_text_file,
            path_exists,
            path_is_dir,
            grant_path_access,
            file_mtime_ms,
            load_state,
            save_state,
            platform_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
