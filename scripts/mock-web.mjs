// Runs the front end in a plain browser, without Tauri.
//
// Starts the normal Vite dev server (with HMR) and injects
// `screenshots/mock.js` into the page, which stands in for the Rust backend:
// a sample notes folder, in-memory saves, no-op window calls. Native dialogs
// (Open File, Open Folder, Save As) act as if cancelled.
//
//   pnpm mock:web            # then open the printed URL
//   pnpm mock:web --update   # with an update to the next patch on offer, notes from CHANGELOG.md
//
// mock.js is re-read on every page load, so edits to it apply on refresh.
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { changelogSection, readVersion } from "./release/release.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MOCK = join(HERE, "screenshots", "mock.js");

const NOTES = "C:\\Users\\etienne\\Notes";
const ACTIVE = `${NOTES}\\ideas\\weekend-project.md`;
const SESSION = { openTabs: [ACTIVE, `${NOTES}\\todo.txt`], activeTab: ACTIVE, recent: [ACTIVE] };

/** What check_update reports with --update: the [Unreleased] entries, or this version's if there are none. */
function sampleUpdate() {
  const version = readVersion();
  const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  const notes = changelogSection(changelog, "Unreleased") || changelogSection(changelog, version);
  const [major, minor, patch] = version.split("-")[0].split(".").map(Number);
  return { version: `${major}.${minor}.${patch + 1}`, notes, date: new Date().toISOString() };
}
const update = process.argv.includes("--update") ? sampleUpdate() : null;

const injectMock = {
  name: "inject-tauri-mock",
  transformIndexHtml: () => [
    {
      tag: "script",
      children: `window.__SHOT__ = ${JSON.stringify({ ...SESSION, version: readVersion(), update })};\n${readFileSync(MOCK, "utf8")}`,
      injectTo: "head-prepend",
    },
  ],
};

const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, "vite.config.ts"),
  plugins: [injectMock],
  // Bind all interfaces, not just localhost (which can resolve to IPv6 ::1
  // only), so the dev container's port forwarding can reach it.
  server: { host: true },
});
await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
