import { describe, expect, it } from "vitest";
import { computeDocStats } from "./docStats";

describe("computeDocStats", () => {
  it("counts chars and words for normal text", () => {
    expect(computeDocStats("hello world")).toEqual({ chars: 11, words: 2 });
  });

  it("treats empty text as zero words", () => {
    expect(computeDocStats("")).toEqual({ chars: 0, words: 0 });
  });

  it("treats whitespace-only text as zero words", () => {
    expect(computeDocStats("   \n\t  ")).toEqual({ chars: 7, words: 0 });
  });

  it("collapses runs of whitespace between words", () => {
    expect(computeDocStats("one   two\nthree")).toEqual({ chars: 15, words: 3 });
  });

  it("ignores leading/trailing whitespace when counting words", () => {
    expect(computeDocStats("  padded  ")).toEqual({ chars: 10, words: 1 });
  });
});
