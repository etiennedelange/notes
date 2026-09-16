import "./styles.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { App } from "./app";
import { openCommandPalette } from "./commandPalette";
import { initTitlebar } from "./titlebar";

window.addEventListener("DOMContentLoaded", async () => {
  initTitlebar();

  const host = document.getElementById("editor-host")!;
  const app = new App(host);
  try {
    await app.init();
    document.getElementById("empty-open-file")!.addEventListener("click", () => app.openFileDialog());
    document.getElementById("empty-quick-open")!.addEventListener("click", () => openCommandPalette(app));
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
