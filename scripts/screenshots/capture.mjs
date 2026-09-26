// Captures marketing screenshots of the app without running Tauri.
//
// The front end runs in headless Chromium against a Vite dev server, and
// `mock.js` stands in for the Rust backend (a fake notes folder, no-op
// window calls). What you see is the real UI; only the files are made up.
//
//   pnpm screenshots                 # every theme and scene
//   pnpm screenshots editor          # just the named scene(s)
//
// Writes, for each theme × scene:
//   docs/screenshots/raw/<scene>-<theme>.png  bare window, 2880×1800
//   docs/screenshots/<scene>-<theme>.png      window on a themed backdrop
//   site/src/assets/screenshots/…             copy of the raw set for the site
//
// First run needs a browser: `pnpm exec playwright install chromium`
// (add `--with-deps` on a fresh Linux box).
import { chromium } from "playwright";
import { createServer } from "vite";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const DOCS = join(ROOT, "docs", "screenshots");
const SITE = join(ROOT, "site", "src", "assets", "screenshots");
const MOCK = readFileSync(join(HERE, "mock.js"), "utf8");

// Window size in CSS px; captured at 2x.
const W = 1440;
const H = 900;

const THEMES = ["nord", "tokyo-night", "noctis-lux"];
const SCENES = ["editor", "palette"];

// Segoe UI and Cascadia Code aren't on Linux; these are next in the app's
// own font stacks, so the shots look like the app with those installed.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,600;0,700;1,400&display=block";

// Backdrop for the framed shots: two glows and a base, from each theme's palette.
const BACKDROP = {
  nord: ["#5e81ac", "#88c0d0", "#2e3440"],
  "tokyo-night": ["#7aa2f7", "#bb9af7", "#1a1b26"],
  "noctis-lux": ["#8fd3dc", "#f3d9a6", "#e8dcc2"],
};

const NOTES = "C:\\Users\\etienne\\Notes";
const ACTIVE = `${NOTES}\\ideas\\weekend-project.md`;
const SESSION = {
  openTabs: [ACTIVE, `${NOTES}\\journal\\2026-09-26.md`, `${NOTES}\\todo.txt`, "C:\\Users\\etienne\\Desktop\\groceries.txt"],
  activeTab: ACTIVE,
  recent: [ACTIVE, `${NOTES}\\journal\\2026-09-26.md`, `${NOTES}\\journal\\2026-09-25.md`, `${NOTES}\\todo.txt`],
};

async function captureRaw(browser, url, theme, scene, out) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__SHOT__ = ${JSON.stringify({ ...SESSION, theme })};\n${MOCK}`);
  await page.goto(url);
  await page.addStyleTag({ url: FONTS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector(".tree-row-dir");

  for (const name of ["ideas", "journal"]) {
    await page.locator(".tree-row-dir", { hasText: name }).first().click();
  }

  // Park the cursor on the closing brace of the code block.
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+Home");
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");

  if (scene === "palette") {
    await page.keyboard.press("Control+p");
    await page.keyboard.type("jour", { delay: 30 });
  }

  await page.mouse.move(W - 5, H / 2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
  await ctx.close();
}

async function frame(page, theme, rawPath, out) {
  const [a, b, base] = BACKDROP[theme];
  const img = readFileSync(rawPath).toString("base64");
  await page.setContent(`<!doctype html><style>
    html, body { margin: 0; height: 100%; }
    body {
      display: grid; place-items: center;
      background:
        radial-gradient(1200px 800px at 12% 8%, ${a}cc, transparent 60%),
        radial-gradient(1000px 800px at 92% 96%, ${b}bb, transparent 60%),
        ${base};
    }
    img {
      display: block; width: ${W}px; height: ${H}px; border-radius: 12px;
      box-shadow: 0 0 0 1px rgba(0,0,0,.25), 0 2px 6px rgba(0,0,0,.18), 0 30px 80px rgba(0,0,0,.40);
    }
  </style><img src="data:image/png;base64,${img}">`);
  await page.waitForLoadState("load");
  await page.screenshot({ path: out });
}

const scenes = process.argv.slice(2).length ? process.argv.slice(2) : SCENES;
for (const dir of [DOCS, join(DOCS, "raw"), SITE]) mkdirSync(dir, { recursive: true });

const server = await createServer({ root: ROOT, configFile: join(ROOT, "vite.config.ts"), logLevel: "warn" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();

try {
  const framePage = await browser.newPage({ viewport: { width: W + 160, height: H + 160 }, deviceScaleFactor: 2 });
  for (const theme of THEMES) {
    for (const scene of scenes) {
      const name = `${scene}-${theme}.png`;
      const raw = join(DOCS, "raw", name);
      await captureRaw(browser, url, theme, scene, raw);
      await frame(framePage, theme, raw, join(DOCS, name));
      copyFileSync(raw, join(SITE, name));
      console.log(name);
    }
  }
} finally {
  await browser.close();
  await server.close();
}
