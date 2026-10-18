import type { EditorState, Text } from "@codemirror/state";
import type { ThemeId } from "./themes";
import type { DirNode } from "./fs";
import type { LineEnding } from "./lineEndings";

export interface Tab {
  key: string;
  path: string | null;
  isUntitled: boolean;
  state: EditorState;
  dirty: boolean;
  /** The doc as last loaded or saved; `dirty` is whether the buffer differs from it. */
  savedDoc: Text;
  diskMtime: number | null;
  pinned: boolean;
  /** The file's own line breaks, restored on save. */
  lineEnding: LineEnding;
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
