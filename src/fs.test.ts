import { describe, it, expect } from "vitest";
import { dirTreesEqual, type DirNode } from "./fs";

const file = (name: string, path: string): DirNode => ({ name, path, isDir: false });

const dir = (name: string, path: string, children: DirNode[]): DirNode => ({
  name,
  path,
  isDir: true,
  children,
});

describe("dirTreesEqual", () => {
  it("is true for two nulls", () => {
    expect(dirTreesEqual(null, null)).toBe(true);
  });

  it("is false when only one side is null", () => {
    const tree = dir("root", "/root", []);
    expect(dirTreesEqual(tree, null)).toBe(false);
    expect(dirTreesEqual(null, tree)).toBe(false);
  });

  it("is true for two structurally identical trees", () => {
    const a = dir("root", "/root", [file("a.md", "/root/a.md")]);
    const b = dir("root", "/root", [file("a.md", "/root/a.md")]);
    expect(dirTreesEqual(a, b)).toBe(true);
  });

  it("is false when a file was added outside the app", () => {
    const before = dir("root", "/root", [file("a.md", "/root/a.md")]);
    const after = dir("root", "/root", [file("a.md", "/root/a.md"), file("new.md", "/root/new.md")]);
    expect(dirTreesEqual(before, after)).toBe(false);
  });

  it("is false when a file was removed outside the app", () => {
    const before = dir("root", "/root", [file("a.md", "/root/a.md"), file("b.md", "/root/b.md")]);
    const after = dir("root", "/root", [file("a.md", "/root/a.md")]);
    expect(dirTreesEqual(before, after)).toBe(false);
  });

  it("is false when a file was renamed", () => {
    const before = dir("root", "/root", [file("a.md", "/root/a.md")]);
    const after = dir("root", "/root", [file("renamed.md", "/root/renamed.md")]);
    expect(dirTreesEqual(before, after)).toBe(false);
  });

  it("is false when the truncated flag changes", () => {
    const before = dir("root", "/root", []);
    const after: DirNode = { ...dir("root", "/root", []), truncated: true };
    expect(dirTreesEqual(before, after)).toBe(false);
  });

  it("is false for nested differences", () => {
    const before = dir("root", "/root", [dir("sub", "/root/sub", [file("a.md", "/root/sub/a.md")])]);
    const after = dir("root", "/root", [dir("sub", "/root/sub", [file("a.md", "/root/sub/a.md"), file("b.md", "/root/sub/b.md")])]);
    expect(dirTreesEqual(before, after)).toBe(false);
  });
});
