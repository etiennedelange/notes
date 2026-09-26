/**
 * Closes off the webview affordances that give the app away as a web page.
 *
 * None of this is a security boundary — the filesystem consent model in
 * `src-tauri/core` is. This is purely about how the window *feels*: a native
 * editor doesn't offer "Reload", doesn't let you rubber-band-select its own
 * status bar, and doesn't drag its sidebar labels out as HTML.
 *
 * Developer affordances stay wired up in `tauri dev`; only production builds
 * lose them, so debugging the app is unaffected by any of this.
 */

/** Keys the webview handles for us that have no meaning in an editor window. */
function isBrowserKey(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;

  // Reload — there is no page to reload, and doing so drops unsaved buffers.
  if (key === "f5") return true;
  if (mod && key === "r") return true;

  // Web inspector. Release builds don't compile devtools in (no `devtools`
  // feature in Cargo.toml), so these are already inert there — but the
  // keystroke itself is the tell, and on Linux WebKitGTK it can still bite.
  if (key === "f12") return true;
  if (mod && e.shiftKey && (key === "i" || key === "j" || key === "c")) return true;

  // View source.
  if (mod && key === "u") return true;

  return false;
}

export function installNativeChrome(): void {
  // The default menu is the browser's ("Back", "Reload", "Inspect Element"),
  // which is the single loudest signal that this is a web view. The tab
  // strip's own menu is a native one (see tabs.ts), so it's unaffected.
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  // Chrome elements are not content: dragging a filename out of the sidebar
  // should do nothing, not start an HTML5 drag carrying markup. The editor
  // opts back in below so text drag-and-drop inside a document still works.
  window.addEventListener("dragstart", (e) => {
    const target = e.target;
    if (target instanceof Element && target.closest(".cm-editor")) return;
    e.preventDefault();
  });

  if (import.meta.env.DEV) return;

  window.addEventListener(
    "keydown",
    (e) => {
      if (isBrowserKey(e)) e.preventDefault();
    },
    // Capture, so the webview's own handling is pre-empted before any
    // application or CodeMirror keymap gets a look at the event.
    true,
  );
}
