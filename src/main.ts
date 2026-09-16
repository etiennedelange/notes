import "./styles.css";
import { App } from "./app";
import { openCommandPalette } from "./commandPalette";
import { initTitlebar } from "./titlebar";

window.addEventListener("DOMContentLoaded", async () => {
  initTitlebar();

  const host = document.getElementById("editor-host")!;
  const app = new App(host);
  await app.init();

  document.getElementById("empty-open-file")!.addEventListener("click", () => app.openFileDialog());
  document.getElementById("empty-quick-open")!.addEventListener("click", () => openCommandPalette(app));
});
