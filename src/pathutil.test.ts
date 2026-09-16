import { describe, it, expect } from "vitest";
import { basename, dirname, isDescendant } from "./pathutil";

describe("basename", () => {
  it("returns the last segment for forward slashes", () => {
    expect(basename("C:/notes/todo.md")).toBe("todo.md");
  });

  it("returns the last segment for backslashes", () => {
    expect(basename("C:\\notes\\todo.md")).toBe("todo.md");
  });

  it("strips a trailing slash before taking the segment", () => {
    expect(basename("C:/notes/sub/")).toBe("sub");
  });

  it("returns the whole string when there is no separator", () => {
    expect(basename("todo.md")).toBe("todo.md");
  });
});

describe("dirname", () => {
  it("returns everything before the last segment", () => {
    expect(dirname("C:/notes/todo.md")).toBe("C:/notes");
  });

  it("handles mixed separators by using whichever is last", () => {
    expect(dirname("C:\\notes/sub\\todo.md")).toBe("C:\\notes/sub");
  });

  it("returns an empty string when there is no separator", () => {
    expect(dirname("todo.md")).toBe("");
  });
});

describe("isDescendant", () => {
  it("is true for a direct child path", () => {
    expect(isDescendant("C:/notes", "C:/notes/todo.md")).toBe(true);
  });

  it("is true for a nested descendant with backslashes", () => {
    expect(isDescendant("C:\\notes", "C:\\notes\\sub\\todo.md")).toBe(true);
  });

  it("is false for an unrelated path", () => {
    expect(isDescendant("C:/notes", "C:/other/todo.md")).toBe(false);
  });

  it("is false for a sibling folder that merely shares a name prefix", () => {
    expect(isDescendant("C:/notes", "C:/notes-archive/todo.md")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDescendant("C:/Notes", "c:/notes/todo.md")).toBe(true);
  });
});
