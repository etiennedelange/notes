import { describe, expect, it } from "vite-plus/test";
import { releaseNotesHtml, updateLabel } from "./update";

describe("updateLabel", () => {
  it("says what the status bar button will do", () => {
    expect(updateLabel("0.5.0", "available")).toBe("Update to 0.5.0");
    expect(updateLabel("0.5.0", "downloading")).toBe("Downloading 0.5.0…");
    expect(updateLabel("0.5.0", "restarting")).toBe("Restarting…");
  });
});

describe("releaseNotesHtml", () => {
  it("renders a CHANGELOG section: headings, wrapped bullets, bold and code", () => {
    const notes = [
      "### Added",
      "- **Check for updates yourself.** The status bar shows the version;",
      "  click it to check for a `newer` one.",
      "- Second item.",
      "",
      "### Fixed",
      "- Hourly checks.",
    ].join("\n");
    expect(releaseNotesHtml(notes)).toBe(
      "<h3>Added</h3>" +
        "<ul><li><strong>Check for updates yourself.</strong> The status bar shows the version; " +
        "click it to check for a <code>newer</code> one.</li><li>Second item.</li></ul>" +
        "<h3>Fixed</h3><ul><li>Hourly checks.</li></ul>",
    );
  });

  it("keeps paragraphs and a link's text", () => {
    expect(releaseNotesHtml("See the\n[release page](https://example.com).")).toBe("<p>See the release page.</p>");
  });

  it("escapes markup in the notes", () => {
    const html = releaseNotesHtml('- <img src=x onerror="alert(1)"> **<b>x</b>**');
    expect(html).toBe(
      "<ul><li>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; <strong>&lt;b&gt;x&lt;/b&gt;</strong></li></ul>",
    );
  });

  it("renders the real CHANGELOG without leftover markdown", () => {
    const section = `### Added
- **Right-click menu in the sidebar.** Right-click a note to rename it,
  delete it or show it in File Explorer. Deleted notes go to the Recycle
  Bin, and an open tab follows a rename, unsaved changes included.
  Right-click a folder to show it in File Explorer.`;
    const html = releaseNotesHtml(section);
    expect(html).not.toMatch(/\*\*|^#|\n/);
    expect(html.match(/<li>/g)).toHaveLength(1);
  });
});
