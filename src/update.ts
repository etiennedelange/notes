import { getVersion } from "@tauri-apps/api/app";
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

/**
 * Notes is often left open for days, so it checks again on this interval;
 * a single startup check never sees a release published after it.
 */
export const UPDATE_RECHECK_MS = 60 * 60 * 1000;

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

/** The update the status bar button offers, once a check has found one. */
let found: UpdateInfo | null = null;

/**
 * Checks GitHub Releases a few seconds after startup, then every hour until
 * it finds a newer version. That shows as a button in the status bar;
 * nothing shows otherwise, and a failed check (offline, no release yet)
 * stays quiet. The version in the status bar checks on demand.
 */
export function initUpdates(app: App) {
  const timer = setInterval(() => void check(), UPDATE_RECHECK_MS);
  const check = async () => {
    try {
      const update = await invoke<UpdateInfo | null>("check_update");
      if (update) {
        clearInterval(timer);
        showUpdate(app, update);
      }
    } catch (e) {
      console.warn(e);
    }
  };
  setTimeout(check, UPDATE_CHECK_DELAY_MS);

  const versionButton = document.getElementById("status-version") as HTMLButtonElement;
  void getVersion().then((version) => {
    versionButton.textContent = `v${version}`;
    versionButton.classList.remove("hidden");
  });
  versionButton.addEventListener("click", async () => {
    if (found) return offerUpdate(app);
    versionButton.disabled = true;
    try {
      const update = await invoke<UpdateInfo | null>("check_update");
      if (update) {
        clearInterval(timer);
        showUpdate(app, update);
        await offerUpdate(app);
      } else {
        showToast(`Notes ${await getVersion()} is up to date.`);
      }
    } catch (e) {
      showToast(String(e), "error");
    } finally {
      versionButton.disabled = false;
    }
  });
}

function updateButton() {
  const button = document.getElementById("status-update") as HTMLButtonElement;
  const label = button.querySelector<HTMLElement>(".status-update-label")!;
  const setPhase = (phase: UpdatePhase) => {
    label.textContent = updateLabel(found!.version, phase);
    button.disabled = phase !== "available";
  };
  return { button, setPhase };
}

function showUpdate(app: App, update: UpdateInfo) {
  const first = !found;
  found = update;
  const { button, setPhase } = updateButton();
  setPhase("available");
  button.title = `Notes ${update.version} is available`;
  button.classList.remove("hidden");
  if (first) button.addEventListener("click", () => void offerUpdate(app));
}

async function offerUpdate(app: App) {
  const update = found!;
  const { setPhase } = updateButton();
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
}
