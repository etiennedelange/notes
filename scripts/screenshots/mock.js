// Fake Tauri backend so the frontend runs in a plain browser.
(() => {
  const cfg = window.__SHOT__ || {};
  const ROOT = "C:\\Users\\etienne\\Notes";
  const J = (...p) => p.join("\\");

  const FILES = {
    [J(ROOT, "README.md")]: `# Notes\n\nA scratchpad for things worth keeping.\n`,
    [J(ROOT, "ideas", "weekend-project.md")]: `# Weekend project: plant watering bot

> Keep it dumb. One sensor, one pump, one schedule.

## Parts

- [x] ESP32 dev board
- [x] Capacitive soil sensor
- [ ] 5V peristaltic pump
- [ ] Relay module

## Wiring notes

The sensor reads **~2800** dry and **~1300** in a glass of water, so
anything under \`1900\` counts as *wet enough*.

\`\`\`rust
fn should_water(reading: u16) -> bool {
    const THRESHOLD: u16 = 1900;
    reading > THRESHOLD
}
\`\`\`

## Open questions

1. Battery or USB power?
2. Does the pump need a flyback diode?
3. Log readings to a \`.csv\` or just blink an LED?

See [the datasheet](https://example.com/sensor.pdf) for timings.
`,
    [J(ROOT, "ideas", "reading-list.md")]: `# Reading list\n\n- *The Pragmatic Programmer*\n- *A Philosophy of Software Design*\n- *Crafting Interpreters*\n`,
    [J(ROOT, "journal", "2026-09-24.md")]: `# Wednesday\n\nShipped the tab pinning fix. Felt good.\n`,
    [J(ROOT, "journal", "2026-09-25.md")]: `# Thursday\n\n- Paired on the release script\n- Sketched the sidebar resize handle\n`,
    [J(ROOT, "journal", "2026-09-26.md")]: `# Friday\n\nQuiet day. Mostly reading.\n`,
    [J(ROOT, "work", "standup.txt")]: `Yesterday: release checklist\nToday: screenshots for the site\nBlockers: none\n`,
    [J(ROOT, "work", "meeting-notes.md")]: `# Planning sync\n\n| Item | Owner | Due |\n| --- | --- | --- |\n| Themes page | Etienne | Fri |\n| Release v0.3 | Etienne | Mon |\n`,
    [J(ROOT, "todo.txt")]: `buy coffee beans\nrenew domain\nback up photos\ncall the plumber about the geyser\n`,
    ["C:\\Users\\etienne\\Desktop\\groceries.txt"]: `eggs\nbread\nrooibos\nbiltong\n`,
  };

  function tree() {
    const root = { name: "Notes", path: ROOT, isDir: true, children: [] };
    const dirs = { [ROOT]: root };
    for (const p of Object.keys(FILES).filter((p) => p.startsWith(ROOT + "\\")).sort()) {
      const parts = p.slice(ROOT.length + 1).split("\\");
      let cur = root;
      let acc = ROOT;
      for (let i = 0; i < parts.length - 1; i++) {
        acc = J(acc, parts[i]);
        if (!dirs[acc]) {
          dirs[acc] = { name: parts[i], path: acc, isDir: true, children: [] };
          cur.children.push(dirs[acc]);
        }
        cur = dirs[acc];
      }
      cur.children.push({ name: parts.at(-1), path: p, isDir: false });
    }
    const sort = (n) => {
      if (!n.children) return;
      n.children.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      n.children.forEach(sort);
    };
    sort(root);
    return root;
  }

  const state = {
    theme: cfg.theme || "nord",
    lastFolder: ROOT,
    recentFiles: cfg.recent || [],
    openTabs: cfg.openTabs || [],
    activeTab: cfg.activeTab,
    pinnedTabs: cfg.pinnedTabs || [],
    sidebarWidth: 250,
  };

  const exists = (p) => p === ROOT || p in FILES || Object.keys(FILES).some((f) => f.startsWith(p + "\\"));

  const handlers = {
    load_state: () => state,
    save_state: () => null,
    platform_name: () => cfg.platform || "windows",
    read_dir_tree: () => tree(),
    read_text_file: ({ path }) => ({ contents: FILES[path] ?? "", lossy: false }),
    write_text_file: () => null,
    path_exists: ({ path }) => exists(path),
    path_is_dir: ({ path }) => exists(path) && !(path in FILES),
    file_mtime_ms: () => 1758873600000,
    "plugin:window|is_maximized": () => false,
    "plugin:window|available_monitors": () => [],
    "plugin:event|listen": () => Math.floor(Math.random() * 1e9),
  };

  let cbId = 0;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
    transformCallback: (cb) => {
      const id = ++cbId;
      window[`_${id}`] = cb;
      return id;
    },
    unregisterCallback: (id) => delete window[`_${id}`],
    convertFileSrc: (p) => p,
    invoke: async (cmd, args) => {
      const h = handlers[cmd];
      return h ? h(args || {}) : null;
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
})();
