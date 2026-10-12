// Runs the front end in a plain browser, without Tauri.
//
// Starts the normal Vite dev server (with HMR) and injects
// `screenshots/mock.js` into the page, which stands in for the Rust backend:
// a sample notes folder, in-memory saves, no-op window calls. Native dialogs
// (Open File, Open Folder, Save As) act as if cancelled.
//
//   pnpm mock:web    # then open the printed URL
//
// mock.js is re-read on every page load, so edits to it apply on refresh.
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const MOCK = join(HERE, "screenshots", "mock.js");

const NOTES = "C:\\Users\\etienne\\Notes";
const ACTIVE = `${NOTES}\\ideas\\weekend-project.md`;
const SESSION = { openTabs: [ACTIVE, `${NOTES}\\todo.txt`], activeTab: ACTIVE, recent: [ACTIVE] };

const injectMock = {
  name: "inject-tauri-mock",
  transformIndexHtml: () => [
    {
      tag: "script",
      children: `window.__SHOT__ = ${JSON.stringify(SESSION)};\n${readFileSync(MOCK, "utf8")}`,
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
