import { describe, expect, it } from "vite-plus/test";
import { minimalChange, type TextChange } from "./textDiff";

function apply(before: string, change: TextChange | null) {
  if (!change) return before;
  return before.slice(0, change.from) + change.insert + before.slice(change.to);
}

describe("minimalChange", () => {
  it("returns null for equal strings", () => {
    expect(minimalChange("same", "same")).toBeNull();
  });

  it("replaces only the changed middle", () => {
    expect(minimalChange("hello world", "hello there world")).toEqual({ from: 6, to: 6, insert: "there " });
  });

  it("handles a deletion", () => {
    expect(minimalChange("abcdef", "abef")).toEqual({ from: 2, to: 4, insert: "" });
  });

  it("handles repeated characters without overlapping prefix and suffix", () => {
    for (const [a, b] of [
      ["aaa", "aaaa"],
      ["aaaa", "aa"],
      ["", "x"],
      ["x", ""],
      ["abab", "ab"],
    ]) {
      expect(apply(a, minimalChange(a, b))).toBe(b);
    }
  });

  it("doesn't split a surrogate pair", () => {
    const change = minimalChange("a😀b", "a😃b")!;
    expect(change).toEqual({ from: 1, to: 3, insert: "😃" });
    const change2 = minimalChange("😀", "x😀");
    expect(apply("😀", change2)).toBe("x😀");
    expect(change2).toEqual({ from: 0, to: 0, insert: "x" });
  });
});
