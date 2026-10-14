import { onBackdropPress } from "./dialog";
import { escapeHtml } from "./html";
import { raiseToasts } from "./toast";

interface ModalButton {
  id: string;
  label: string;
  variant?: "solid" | "ghost";
  danger?: boolean;
  autofocus?: boolean;
}

interface ModalOptions {
  title: string;
  message: string;
  danger?: boolean;
  /** The warning icon; on by default. Off for news, such as an update. */
  icon?: boolean;
  buttons: ModalButton[];
  /** A scrolling block of rich text under the message, such as release notes. Already-escaped HTML. */
  notesHtml?: string;
  /** A text field under the message, prefilled with this value. */
  input?: { value: string; selectTo?: number };
  /** The button pressing Enter in the text field clicks. */
  submitId?: string;
}

let wired = false;
let resolver: ((value: string) => void) | null = null;
let submitId: string | null = null;

function els() {
  return {
    modal: document.getElementById("confirm-modal") as HTMLDialogElement,
    title: document.getElementById("confirm-title")!,
    message: document.getElementById("confirm-message")!,
    icon: document.getElementById("confirm-icon")!,
    actions: document.getElementById("confirm-actions")!,
    input: document.getElementById("confirm-input") as HTMLInputElement,
    notes: document.getElementById("confirm-notes")!,
  };
}

/**
 * Shows the themed modal and resolves with the id of the clicked button, or
 * "cancel" if dismissed. It's a native modal `<dialog>`: the browser traps
 * focus, makes the rest of the window inert, and puts focus back where it
 * was on close.
 */
export function showModal(opts: ModalOptions): Promise<string> {
  const { modal, title, message, icon, actions, input, notes } = els();

  title.textContent = opts.title;
  message.textContent = opts.message;
  notes.innerHTML = opts.notesHtml ?? "";
  notes.scrollTop = 0;
  notes.classList.toggle("hidden", !opts.notesHtml);
  modal.classList.toggle("confirm-wide", !!opts.notesHtml);
  modal.classList.toggle("confirm-danger", !!opts.danger);
  icon.classList.toggle("confirm-danger", !!opts.danger);
  icon.classList.toggle("hidden", opts.icon === false);

  const autofocusId = opts.buttons.find((b) => b.autofocus)?.id ?? opts.buttons[opts.buttons.length - 1]?.id;
  actions.innerHTML = opts.buttons
    .map(
      (b) => `
      <button
        class="${b.variant === "ghost" ? "ghost-btn" : "solid-btn"} ${b.danger ? "btn-danger" : ""}"
        data-action="${escapeHtml(b.id)}"
        ${b.id === autofocusId ? "autofocus" : ""}
      >${escapeHtml(b.label)}</button>`,
    )
    .join("");

  input.classList.toggle("hidden", !opts.input);
  input.value = opts.input?.value ?? "";
  submitId = opts.submitId ?? null;

  wireOnce();
  if (!modal.open) {
    modal.showModal();
    raiseToasts();
  }
  if (opts.input) {
    input.focus();
    input.setSelectionRange(0, opts.input.selectTo ?? input.value.length);
  }

  return new Promise<string>((resolve) => {
    resolver = resolve;
  });
}

export function confirmModal(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return showModal({
    title: opts.title,
    message: opts.message,
    danger: opts.danger,
    buttons: [
      { id: "cancel", label: opts.cancelLabel ?? "Cancel", variant: "ghost" },
      { id: "confirm", label: opts.confirmLabel ?? "Confirm", danger: opts.danger, autofocus: true },
    ],
  }).then((id) => id === "confirm");
}

/**
 * Asks for a line of text. Resolves with what was entered, or null if
 * cancelled. `selectTo` preselects the start of the value, such as a file
 * name without its extension.
 */
export async function promptModal(opts: {
  title: string;
  message: string;
  value: string;
  selectTo?: number;
  confirmLabel: string;
}): Promise<string | null> {
  const id = await showModal({
    title: opts.title,
    message: opts.message,
    icon: false,
    input: { value: opts.value, selectTo: opts.selectTo },
    submitId: "confirm",
    buttons: [
      { id: "cancel", label: "Cancel", variant: "ghost" },
      { id: "confirm", label: opts.confirmLabel },
    ],
  });
  return id === "confirm" ? els().input.value : null;
}

/** Save / Don't Save / Cancel — the standard unsaved-changes choice. */
export function unsavedChangesModal(opts: {
  title: string;
  message: string;
  saveLabel?: string;
}): Promise<"save" | "discard" | "cancel"> {
  return showModal({
    title: opts.title,
    message: opts.message,
    danger: true,
    buttons: [
      { id: "cancel", label: "Cancel", variant: "ghost" },
      { id: "discard", label: "Don't Save", variant: "ghost", danger: true },
      { id: "save", label: opts.saveLabel ?? "Save", autofocus: true },
    ],
  }).then((id) => (id === "save" || id === "discard" ? id : "cancel"));
}

function settle(value: string) {
  const { modal } = els();
  if (modal.open) modal.close();
  resolver?.(value);
  resolver = null;
}

function wireOnce() {
  if (wired) return;
  wired = true;
  const { modal, actions, input } = els();

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && submitId) {
      e.preventDefault();
      settle(submitId);
    }
  });
  actions.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
    if (btn) settle(btn.dataset.action!);
  });
  // Escape. Closing goes through settle so the promise resolves.
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    settle("cancel");
  });
  onBackdropPress(modal, () => settle("cancel"));
}
