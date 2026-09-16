import { describe, it, expect } from "vitest";
import { fuzzyMatch, fuzzyFilter } from "./fuzzy";

describe("fuzzyMatch", () => {
  it("matches an empty query against anything with zero score", () => {
    expect(fuzzyMatch("", "whatever.md")).toEqual({ score: 0, indices: [] });
  });

  it("matches a subsequence regardless of case", () => {
    const result = fuzzyMatch("NTS", "notes.txt");
    expect(result).not.toBeNull();
    expect(result!.indices).toEqual([0, 2, 4]);
  });

  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyMatch("xyz", "notes.txt")).toBeNull();
  });

  it("scores a consecutive run higher than a scattered match", () => {
    const consecutive = fuzzyMatch("not", "notes.txt")!;
    const scattered = fuzzyMatch("nts", "notes.txt")!;
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });

  it("rewards matches that start at a word boundary", () => {
    const boundary = fuzzyMatch("conf", "app_config.txt")!;
    const midWord = fuzzyMatch("ppco", "app_config.txt")!;
    expect(boundary.score).toBeGreaterThan(midWord.score);
  });
});

describe("fuzzyFilter", () => {
  const items = ["readme.md", "recipe.txt", "notes.md", "budget.txt"];

  it("returns every item, unscored, for an empty query", () => {
    const result = fuzzyFilter("", items, (s) => s);
    expect(result.map((r) => r.item)).toEqual(items);
  });

  it("excludes non-matching items and sorts by descending score", () => {
    const result = fuzzyFilter("re", items, (s) => s);
    const names = result.map((r) => r.item);
    expect(names).toContain("readme.md");
    expect(names).toContain("recipe.txt");
    expect(names).not.toContain("notes.md");
    expect(names).not.toContain("budget.txt");
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].match.score).toBeGreaterThanOrEqual(result[i].match.score);
    }
  });
});
