import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import type { App } from "./app";
import { escapeHtml } from "./html";
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

/** `**bold**` and `` `code` ``; a link keeps only its text, since the dialog can't open it. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/**
 * The CHANGELOG section as HTML for the update dialog. It handles what the
 * CHANGELOG uses (### headings, bullets that wrap onto indented lines,
 * paragraphs, bold, code) and escapes everything else, so the release notes
 * can't put markup into the app.
 */
export function releaseNotesHtml(notes: string): string {
  const out: string[] = [];
  let list: string[] | null = null;
  let item: string | null = null;
  let para: string | null = null;
  const flush = () => {
    if (item !== null) list!.push(`<li>${inline(item)}</li>`);
    item = null;
    if (list) out.push(`<ul>${list.join("")}</ul>`);
    list = null;
    if (para !== null) out.push(`<p>${inline(para)}</p>`);
    para = null;
  };
  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (heading) {
      flush();
      out.push(`<h3>${inline(heading[1]!)}</h3>`);
    } else if (bullet) {
      if (para !== null || !list) flush();
      if (item !== null) list!.push(`<li>${inline(item)}</li>`);
      list ??= [];
      item = bullet[1]!;
    } else if (item !== null) {
      item += ` ${line}`;
    } else {
      para = para === null ? line : `${para} ${line}`;
    }
  }
  flush();
  return out.join("");
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
  const notesHtml = update.notes ? releaseNotesHtml(update.notes) : "";
  const choice = await showModal({
    title: `Notes ${update.version} is available`,
    icon: false,
    message:
      "Notes downloads it, asks about any unsaved changes, then restarts on the new version with your tabs open.",
    notesHtml,
    buttons: [
      // With the notes shown here, the page is for the rest: the installer, earlier releases.
      { id: "notes", label: notesHtml ? "Release Page" : "What's New", variant: "ghost" },
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
