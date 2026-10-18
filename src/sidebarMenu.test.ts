import { describe, expect, it } from "vite-plus/test";
import { folderContentsPhrase } from "./sidebarMenu";

describe("folderContentsPhrase", () => {
  it("says nothing more for an empty folder", () => {
    expect(folderContentsPhrase({ notes: 0, otherFiles: 0, truncated: false })).toBe("");
  });

  it("names notes and the files the tree hides, singular and plural", () => {
    expect(folderContentsPhrase({ notes: 1, otherFiles: 0, truncated: false })).toBe(", with 1 note in it");
    expect(folderContentsPhrase({ notes: 0, otherFiles: 2, truncated: false })).toBe(", with 2 other files in it");
    expect(folderContentsPhrase({ notes: 3, otherFiles: 1, truncated: false })).toBe(
      ", with 3 notes and 1 other file in it",
    );
  });

  it("marks a count that stopped early as a floor", () => {
    expect(folderContentsPhrase({ notes: 5, otherFiles: 19995, truncated: true })).toBe(
      ", with 5+ notes and 19995+ other files in it",
    );
  });
});
