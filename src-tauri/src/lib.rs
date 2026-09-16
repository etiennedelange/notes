use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
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
        if name.starts_with('.') && name != ".gitignore" {
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
            let children = walk_dir(&path, depth + 1, budget);
            if children.is_empty() {
                continue; // hide folders with nothing relevant inside
            }
            *budget -= 1;
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

#[tauri::command]
fn read_dir_tree(root: String) -> Result<DirNode, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(format!("Not a directory: {root}"));
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

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Couldn't read {path}: {e}"))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Couldn't create {path}: {e}"))?;
        }
    }
    fs::write(&path, contents).map_err(|e| format!("Couldn't save {path}: {e}"))
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn file_mtime_ms(path: String) -> Result<u64, String> {
    let meta = fs::metadata(&path).map_err(|e| format!("Couldn't stat {path}: {e}"))?;
    let modified = meta
        .modified()
        .map_err(|e| format!("No mtime for {path}: {e}"))?;
    let ms = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    Ok(ms)
}

#[tauri::command]
fn file_name_of(path: String) -> String {
    Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or(path)
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

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("No config dir: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir.join("state.json"))
}

#[tauri::command]
fn load_state(app: tauri::AppHandle) -> Result<AppStateDto, String> {
    let path = state_path(&app)?;
    if !path.exists() {
        return Ok(AppStateDto::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_state(app: tauri::AppHandle, state: AppStateDto) -> Result<(), String> {
    let path = state_path(&app)?;
    let raw = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn platform_name() -> &'static str {
    std::env::consts::OS
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_dir_tree,
            read_text_file,
            write_text_file,
            path_exists,
            file_mtime_ms,
            file_name_of,
            load_state,
            save_state,
            platform_name,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
