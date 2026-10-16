import { describe, it, expect } from "vite-plus/test";
import { EditorState, Text } from "@codemirror/state";
import { detectLineEnding, textForDisk } from "./lineEndings";

describe("line endings", () => {
  it("detects the first line break's style", () => {
    expect(detectLineEnding("a\r\nb\nc")).toBe("\r\n");
    expect(detectLineEnding("a\nb\r\nc")).toBe("\n");
    expect(detectLineEnding("no breaks")).toBe("\n");
    expect(detectLineEnding("\nleading")).toBe("\n");
  });

  it("round-trips a Windows file through the editor unchanged", () => {
    const onDisk = "one\r\ntwo\r\n\r\nthree\r\n";
    const doc = EditorState.create({ doc: onDisk }).doc;
    expect(textForDisk(doc, detectLineEnding(onDisk))).toBe(onDisk);
  });

  it("writes Unix line breaks for a Unix file", () => {
    expect(textForDisk(Text.of(["a", "b", ""]), "\n")).toBe("a\nb\n");
  });
});
