import "./styles.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { App } from "./app";
import { openCommandPalette } from "./commandPalette";
import { initTitlebar } from "./titlebar";
import { installNativeChrome } from "./nativeChrome";
import { showToast } from "./toast";

// Before DOMContentLoaded: these are window-level listeners, and a right-click
// or F5 landing during startup should already be swallowed.
installNativeChrome();

window.addEventListener("DOMContentLoaded", async () => {
  initTitlebar();

  const host = document.getElementById("editor-host")!;
  const app = new App(host);
  document.getElementById("empty-open-file")!.addEventListener("click", () => app.openFileDialog());
  document.getElementById("empty-quick-open")!.addEventListener("click", () => openCommandPalette(app));
  try {
    await app.init();
  } catch (e) {
    showToast(`Couldn't start: ${e}`, "error");
  } finally {
    // The window starts hidden (see tauri.conf.json) to avoid a white flash
    // before the theme is applied; reveal it once painted, or on init failure
    // — an invisible stuck window is worse than an unstyled one.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        getCurrentWindow().show();
      });
    });
  }
});
