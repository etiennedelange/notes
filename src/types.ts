import type { EditorState } from "@codemirror/state";
import type { ThemeId } from "./themes";
import type { DirNode } from "./fs";

export interface Tab {
  key: string;
  path: string | null;
  isUntitled: boolean;
  state: EditorState;
  dirty: boolean;
  diskMtime: number | null;
  pinned: boolean;
}

export interface AppSnapshot {
  tabs: Map<string, Tab>;
  order: string[];
  activeKey: string | null;
  openFolder: string | null;
  tree: DirNode | null;
  looseFiles: string[];
  recentFiles: string[];
  theme: ThemeId;
  expandedDirs: Set<string>;
}
