import { getCurrentWindow } from "@tauri-apps/api/window";
import { platformName } from "./fs";

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
  const dragRegion = document.querySelector<HTMLElement>(".titlebar-drag")!;
  const maximizeIcon = maximizeBtn.querySelector("use")!;

  async function syncMaximizeIcon() {
    const isMax = await win.isMaximized().catch(() => false);
    maximizeIcon.setAttribute("href", isMax ? "#icon-tb-restore" : "#icon-tb-maximize");
    maximizeBtn.title = isMax ? "Restore" : "Maximize";
  }

  minimizeBtn.addEventListener("click", () => win.minimize());
  closeBtn.addEventListener("click", () => win.close());
  maximizeBtn.addEventListener("click", async () => {
    await win.toggleMaximize();
    syncMaximizeIcon();
  });
  dragRegion.addEventListener("dblclick", async () => {
    await win.toggleMaximize();
    syncMaximizeIcon();
  });

  win.onResized(() => syncMaximizeIcon()).catch(() => {});
  syncMaximizeIcon();
}
