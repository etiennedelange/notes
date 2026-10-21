import { describe, expect, it } from "vite-plus/test";
import { languageName } from "./editor";

describe("languageName", () => {
  it("picks the language from the extension, case-insensitively", () => {
    expect(languageName("C:\\notes\\a.md")).toBe("Markdown");
    expect(languageName("/notes/b.MARKDOWN")).toBe("Markdown");
    expect(languageName("/notes/config.JSON")).toBe("JSON");
    expect(languageName("/notes/todo.txt")).toBe("Plain Text");
  });
});
