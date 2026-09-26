import { invoke } from "@tauri-apps/api/core";

export interface DirNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: DirNode[];
  /** True on the root node when MAX_TREE_ENTRIES cut the walk short. */
  truncated?: boolean;
}

export interface PersistedState {
  theme?: string;
  zoom?: number;
  editorZoom?: number;
  sidebarWidth?: number;
  lastFolder?: string;
  recentFiles: string[];
  openTabs: string[];
  activeTab?: string;
  pinnedTabs: string[];
  windowX?: number;
  windowY?: number;
  windowWidth?: number;
  windowHeight?: number;
  windowMaximized?: boolean;
}

export interface ReadFileResult {
  contents: string;
  /** True if the file wasn't valid UTF-8 and was decoded with replacement characters. */
  lossy: boolean;
}

export const readDirTree = (root: string) => invoke<DirNode>("read_dir_tree", { root });
export const readTextFile = (path: string) => invoke<ReadFileResult>("read_text_file", { path });
export const writeTextFile = (path: string, contents: string) =>
  invoke<void>("write_text_file", { path, contents });
export const pathExists = (path: string) => invoke<boolean>("path_exists", { path });
export const pathIsDir = (path: string) => invoke<boolean>("path_is_dir", { path });
export const fileMtimeMs = (path: string) => invoke<number>("file_mtime_ms", { path });
export const loadState = () => invoke<PersistedState>("load_state");
export const saveState = (state: PersistedState) => invoke<void>("save_state", { persisted: state });

// Native dialogs run in Rust, which grants whatever the user picks before
// returning it. Each resolves to null if the dialog is cancelled.
export const pickFolder = () => invoke<string | null>("pick_folder");
export const pickNoteFile = () => invoke<string | null>("pick_note_file");

export interface SaveTarget {
  path: string;
  /** True if `.md` was appended to the picked name, which the dialog never confirmed overwriting. */
  extensionAdded: boolean;
}
export const pickSaveTarget = (defaultPath: string) => invoke<SaveTarget | null>("pick_save_path", { defaultPath });
export const platformName = () => invoke<string>("platform_name");
