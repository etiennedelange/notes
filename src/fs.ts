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
  lastFolder?: string;
  recentFiles: string[];
  openTabs: string[];
  activeTab?: string;
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
export const grantPathAccess = (path: string) => invoke<void>("grant_path_access", { path });
export const loadState = () => invoke<PersistedState>("load_state");
export const saveState = (state: PersistedState) => invoke<void>("save_state", { state });
export const platformName = () => invoke<string>("platform_name");
