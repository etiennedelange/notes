// End-to-end tests for editing, saving, outside changes and dropping files.
//
// The real front end runs in headless Chromium against a Vite dev server,
// with `scripts/screenshots/mock.js` standing in for the Rust backend (an
// in-memory notes folder). `window.__MOCK__` lets a test inspect writes,
// change a file as another app would, and fire the window-focus event.
//
//   pnpm test:e2e
//
// First run needs a browser: `pnpm exec playwright install chromium`
// (add `--with-deps` on a fresh Linux box).
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOCK = readFileSync(join(ROOT, "scripts", "screenshots", "mock.js"), "utf8");

const NOTES = "C:\\Users\\etienne\\Notes";
const TODO = `${NOTES}\\todo.txt`;
const STANDUP = `${NOTES}\\work\\standup.txt`;
const GROCERIES = "C:\\Users\\etienne\\Desktop\\groceries.txt";
const TODO_TEXT = "buy coffee beans\nrenew domain\nback up photos\ncall the plumber about the geyser\n";
const SESSION = { openTabs: [TODO, STANDUP], activeTab: TODO, recent: [TODO] };

let server;
let browser;
let url;
let page;

before(async () => {
  server = await createServer({
    root: ROOT,
    configFile: join(ROOT, "vite.config.ts"),
    logLevel: "error",
    server: { port: 0 },
  });
  await server.listen();
  url = server.resolvedUrls.local[0];
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

beforeEach(async () => {
  await page?.context().close();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await ctx.newPage();
  page.on("pageerror", (e) => assert.fail(`page error: ${e.message}`));
  await page.addInitScript(`window.__SHOT__ = ${JSON.stringify(SESSION)};\n${MOCK}`);
  await page.goto(url);
  await page.locator(".cm-content").waitFor();
  await waitForText(TODO_TEXT);
});

// ---------- helpers ----------

const tab = (name) => page.locator(".tab", { hasText: name });
const writes = () => page.evaluate(() => [...window.__MOCK__.writes]);
const modalOpen = () => page.evaluate(() => document.getElementById("confirm-modal").open);
const cursor = () => page.locator("#status-cursor").textContent();
const isDirty = async (name) => (await tab(name).getAttribute("class")).split(/\s+/).includes("dirty");
const sidebarDot = (name) => page.locator("#folder-tree .tree-row-file", { hasText: name }).locator(".dot");

/** The editor's text. Every line of these short notes is rendered, so joining them gives the doc. */
const docText = () =>
  page.evaluate(() => [...document.querySelectorAll(".cm-line")].map((l) => l.textContent).join("\n"));

/** Waits for the editor to show `expected`, failing with a diff if it never does. */
async function waitForText(expected) {
  const deadline = Date.now() + 5000;
  let actual = await docText();
  while (actual !== expected && Date.now() < deadline) {
    await page.waitForTimeout(50);
    actual = await docText();
  }
  assert.equal(actual, expected);
}

async function editEnd(keys) {
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(keys);
}

/** Changes a file as another app would, then brings the window back into focus. */
async function changeOutside(path, contents) {
  await page.evaluate(([p, c]) => window.__MOCK__.writeExternally(p, c), [path, contents]);
  await page.evaluate(() => window.__MOCK__.emit("tauri://focus"));
}

// ---------- tests ----------

describe("modified indicator", () => {
  it("clears after typing a character and backspacing it", async () => {
    await editEnd("x");
    assert.equal(await isDirty("todo.txt"), true);
    await page.keyboard.press("Backspace");
    assert.equal(await isDirty("todo.txt"), false);
    assert.equal(await page.locator("#status-dirty").isHidden(), true);
  });

  it("clears after undoing back to the saved text", async () => {
    await editEnd("hello");
    assert.equal(await isDirty("todo.txt"), true);
    await page.keyboard.press("Control+z");
    await waitForText(TODO_TEXT);
    assert.equal(await isDirty("todo.txt"), false);
  });

  it("returns after redoing the edit", async () => {
    await editEnd("hello");
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+y");
    assert.equal(await isDirty("todo.txt"), true);
  });

  it("doesn't ask to save when closing a tab that's back to its saved text", async () => {
    await editEnd("x");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Control+w");
    await page.waitForTimeout(200);
    assert.equal(await modalOpen(), false);
    assert.equal(await tab("todo.txt").count(), 0);
  });
});

describe("saving", () => {
  it("doesn't write a note with no changes", async () => {
    await page.locator(".cm-content").click();
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(200);
    assert.deepEqual(await writes(), []);
  });

  it("writes a changed note once and marks it clean", async () => {
    await editEnd("x");
    assert.equal(await sidebarDot("todo.txt").count(), 1);
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => window.__MOCK__.writes.length > 0);
    assert.deepEqual(await writes(), [TODO]);
    assert.equal(await isDirty("todo.txt"), false);
    assert.equal(await sidebarDot("todo.txt").count(), 0);
    const onDisk = await page.evaluate((p) => window.__MOCK__.files[p], TODO);
    assert.equal(onDisk, `${TODO_TEXT}x`);
  });

  it("keeps a tab modified when typing continues during the save", async () => {
    await editEnd("a");
    await page.evaluate(() => window.__MOCK__.pauseWrites());
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => window.__MOCK__.calls.includes("write_text_file"));
    await page.keyboard.type("b");
    await page.evaluate(() => window.__MOCK__.resumeWrites());
    await page.waitForFunction(() => window.__MOCK__.writes.length > 0);
    await page.waitForTimeout(100);

    const onDisk = await page.evaluate((p) => window.__MOCK__.files[p], TODO);
    assert.equal(onDisk, `${TODO_TEXT}a`);
    assert.equal(await isDirty("todo.txt"), true);
  });

  it("still asks where to save a new note with nothing in it", async () => {
    await page.keyboard.press("Control+n");
    await tab("Untitled").waitFor();
    await page.keyboard.press("Control+s");
    await page.waitForFunction(() => window.__MOCK__.calls.includes("pick_save_path"));
    assert.deepEqual(await writes(), []);
  });
});

describe("outside changes", () => {
  it("reload a clean tab on focus, keeping it clean and the cursor in place", async () => {
    await page.locator(".cm-content").click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    const before = await cursor();

    const changed = `${TODO_TEXT}water the plants\n`;
    await changeOutside(TODO, changed);
    await waitForText(changed);
    assert.equal(await isDirty("todo.txt"), false);
    assert.equal(await cursor(), before);
    assert.deepEqual(await writes(), []);
  });

  it("reload a background tab", async () => {
    const changed = "Yesterday: shipped\n";
    await changeOutside(STANDUP, changed);
    await page.waitForTimeout(200);
    await tab("standup.txt").click();
    await waitForText(changed);
    assert.equal(await isDirty("standup.txt"), false);
  });

  it("can be undone, which marks the tab modified", async () => {
    const changed = `${TODO_TEXT}water the plants\n`;
    await changeOutside(TODO, changed);
    await waitForText(changed);
    await page.locator(".cm-content").click();
    await page.keyboard.press("Control+z");
    await waitForText(TODO_TEXT);
    assert.equal(await isDirty("todo.txt"), true);
  });

  it("leave a tab with unsaved changes alone, and saving it asks first", async () => {
    await editEnd("mine");
    await changeOutside(TODO, "theirs\n");
    await page.waitForTimeout(200);
    await waitForText(`${TODO_TEXT}mine`);
    assert.equal(await isDirty("todo.txt"), true);

    await page.keyboard.press("Control+s");
    const modal = page.locator("#confirm-modal");
    await modal.getByText("File changed on disk").waitFor();
    assert.deepEqual(await writes(), []);
  });

  it("ignore a file rewritten with Windows line endings but the same text", async () => {
    await changeOutside(TODO, TODO_TEXT.replaceAll("\n", "\r\n"));
    await page.waitForTimeout(200);
    await waitForText(TODO_TEXT);
    assert.equal(await isDirty("todo.txt"), false);
    // Nothing was applied, so there's nothing to undo.
    await page.locator(".cm-content").click();
    await page.keyboard.press("Control+z");
    assert.equal(await isDirty("todo.txt"), false);
  });

  it("leave a tab alone when its file was deleted", async () => {
    await page.evaluate((p) => window.__MOCK__.deleteExternally(p), TODO);
    await page.evaluate(() => window.__MOCK__.emit("tauri://focus"));
    await page.waitForTimeout(200);
    await waitForText(TODO_TEXT);
    assert.equal(await tab("todo.txt").count(), 1);
    assert.equal(await isDirty("todo.txt"), false);
  });

  it("don't promote a preview tab", async () => {
    const readme = `${NOTES}\\README.md`;
    await page.locator(`.tree-row-file[data-file="${readme.replaceAll("\\", "\\\\")}"]`).click();
    await tab("README.md").and(page.locator(".preview")).waitFor();

    await changeOutside(readme, "# Notes\n\nChanged elsewhere.\n");
    await waitForText("# Notes\n\nChanged elsewhere.\n");
    assert.equal(await tab("README.md").and(page.locator(".preview")).count(), 1);
  });
});

describe("dropping a file", () => {
  it("opens a file from outside the folder without pinning it", async () => {
    await page.evaluate((p) => window.__MOCK__.emit("notes://drop", [p]), GROCERIES);
    await tab("groceries.txt").waitFor();
    await waitForText("eggs\nbread\nrooibos\nbiltong\n");
    assert.equal(await page.locator("#loose-files", { hasText: "groceries.txt" }).count(), 0);
  });
});
