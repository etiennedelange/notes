import type { Text } from "@codemirror/state";

/**
 * The editor splits lines on any of `\n`, `\r\n` and `\r` and joins them
 * with `\n`, so a file's own line breaks have to be remembered and put back
 * on save, or every save of a Windows file rewrites every line.
 */
export type LineEnding = "\n" | "\r\n";

/** The style of a file's first line break; `\n` if it has none. */
export function detectLineEnding(text: string): LineEnding {
  const i = text.indexOf("\n");
  return i > 0 && text[i - 1] === "\r" ? "\r\n" : "\n";
}

/** The doc as it should be written to disk. */
export function textForDisk(doc: Text, lineEnding: LineEnding): string {
  return doc.sliceString(0, doc.length, lineEnding);
}
