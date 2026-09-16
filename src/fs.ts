import { invoke } from "@tauri-apps/api/core";

export interface DirNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: DirNode[];
}

export interface PersistedState {
  theme?: string;
  lastFolder?: string;
  recentFiles: string[];
  openTabs: string[];
  activeTab?: string;
}

export const readDirTree = (root: string) => invoke<DirNode>("read_dir_tree", { root });
export const readTextFile = (path: string) => invoke<string>("read_text_file", { path });
export const writeTextFile = (path: string, contents: string) =>
  invoke<void>("write_text_file", { path, contents });
export const pathExists = (path: string) => invoke<boolean>("path_exists", { path });
export const fileMtimeMs = (path: string) => invoke<number>("file_mtime_ms", { path });
export const loadState = () => invoke<PersistedState>("load_state");
export const saveState = (state: PersistedState) => invoke<void>("save_state", { state });
export const platformName = () => invoke<string>("platform_name");
