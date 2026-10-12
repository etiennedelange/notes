import { invoke } from "@tauri-apps/api/core";
import type { App } from "./app";
import { showModal } from "./modal";
import { showToast } from "./toast";

/** What check_update reports when a newer version is published (update.rs). */
export interface UpdateInfo {
  version: string;
  /** The release's CHANGELOG section. */
  notes: string | null;
  /** RFC 3339. */
  date: string | null;
}

/** The startup check waits this long, so it never competes with restoring the session. */
export const UPDATE_CHECK_DELAY_MS = 5000;

export type UpdatePhase = "available" | "downloading" | "restarting";

export function updateLabel(version: string, phase: UpdatePhase): string {
  switch (phase) {
    case "available":
      return `Update to ${version}`;
    case "downloading":
      return `Downloading ${version}…`;
    case "restarting":
      return "Restarting…";
  }
}

/**
 * Checks GitHub Releases once, a few seconds after startup. A newer version
 * shows as a button in the status bar; nothing shows otherwise, and a failed
 * check (offline, no release yet) stays quiet.
 */
export function initUpdates(app: App) {
  setTimeout(async () => {
    try {
      const update = await invoke<UpdateInfo | null>("check_update");
      if (update) showUpdate(app, update);
    } catch (e) {
      console.warn(e);
    }
  }, UPDATE_CHECK_DELAY_MS);
}

function showUpdate(app: App, update: UpdateInfo) {
  const button = document.getElementById("status-update") as HTMLButtonElement;
  const label = button.querySelector<HTMLElement>(".status-update-label")!;
  const setPhase = (phase: UpdatePhase) => {
    label.textContent = updateLabel(update.version, phase);
    button.disabled = phase !== "available";
  };
  setPhase("available");
  button.title = `Notes ${update.version} is available`;
  button.classList.remove("hidden");

  button.addEventListener("click", async () => {
    const choice = await showModal({
      title: `Notes ${update.version} is available`,
      icon: false,
      message:
        "Notes downloads it, asks about any unsaved changes, then restarts on the new version with your tabs open.",
      buttons: [
        { id: "notes", label: "What's New", variant: "ghost" },
        { id: "later", label: "Later", variant: "ghost" },
        { id: "update", label: "Update Now", autofocus: true },
      ],
    });
    if (choice === "notes") {
      invoke("open_release_page", { version: update.version }).catch((e) => showToast(String(e), "error"));
      return;
    }
    if (choice !== "update") return;

    setPhase("downloading");
    try {
      await invoke("download_update");
      // Asked after the download, right before exiting, so nothing typed
      // while it downloaded is lost.
      if (!(await app.prepareToExit("updating"))) {
        setPhase("available");
        return;
      }
      setPhase("restarting");
      await invoke("install_update");
    } catch (e) {
      setPhase("available");
      showToast(String(e), "error");
    }
  });
}
