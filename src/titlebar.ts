import { getCurrentWindow } from "@tauri-apps/api/window";
import { platformName } from "./fs";
import { showToast } from "./toast";

export async function initTitlebar() {
  const win = getCurrentWindow();

  platformName()
    .then((platform) => {
      document.documentElement.dataset.platform = platform;
    })
    .catch(() => {});

  const minimizeBtn = document.getElementById("tb-minimize")!;
  const maximizeBtn = document.getElementById("tb-maximize")!;
  const closeBtn = document.getElementById("tb-close")!;
  const maximizeIcon = maximizeBtn.querySelector("use")!;

  async function syncMaximizeIcon() {
    const isMax = await win.isMaximized().catch(() => false);
    maximizeIcon.setAttribute("href", isMax ? "#icon-tb-restore" : "#icon-tb-maximize");
    maximizeBtn.title = isMax ? "Restore" : "Maximize";
  }

  minimizeBtn.addEventListener("click", () => {
    win.minimize().catch((e) => showToast(`Minimize failed: ${e}`, "error"));
  });
  closeBtn.addEventListener("click", () => {
    win.close().catch((e) => showToast(`Close failed: ${e}`, "error"));
  });
  maximizeBtn.addEventListener("click", async () => {
    try {
      await win.toggleMaximize();
      syncMaximizeIcon();
    } catch (e) {
      showToast(`Maximize failed: ${e}`, "error");
    }
  });
  // Tauri's own drag-region handler (drag.js) owns double-click-to-maximize
  // now that the region is `data-tauri-drag-region="deep"`; a manual
  // `dblclick` listener here raced its `mousedown` handling and made the
  // gesture flaky.
  win.onResized(() => syncMaximizeIcon()).catch(() => {});
  syncMaximizeIcon();
}
