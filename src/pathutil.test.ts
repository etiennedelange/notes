import { describe, it, expect } from "vite-plus/test";
import { basename, dirname, isDescendant, suggestedFileName } from "./pathutil";

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

describe("suggestedFileName", () => {
  it("uses the first heading without its marker", () => {
    expect(suggestedFileName("\n\n# Shopping list\n- milk")).toBe("Shopping list");
  });

  it("uses a plain first line as is", () => {
    expect(suggestedFileName("Meeting notes\r\nmore")).toBe("Meeting notes");
  });

  it("drops characters file systems refuse", () => {
    expect(suggestedFileName('Q3: plans/ideas? "draft"')).toBe("Q3 plansideas draft");
  });

  it("caps the length", () => {
    expect(suggestedFileName("a".repeat(100))).toHaveLength(60);
  });

  it("falls back to Untitled for empty or symbol-only notes", () => {
    expect(suggestedFileName("")).toBe("Untitled");
    expect(suggestedFileName("  \n# \n")).toBe("Untitled");
    expect(suggestedFileName("...")).toBe("Untitled");
  });
});
