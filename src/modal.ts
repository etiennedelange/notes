import { escapeHtml } from "./html";

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
  buttons: ModalButton[];
}

let wired = false;
let resolver: ((value: string) => void) | null = null;
let previouslyFocused: HTMLElement | null = null;

function els() {
  return {
    overlay: document.getElementById("confirm-overlay")!,
    modal: document.getElementById("confirm-modal")!,
    title: document.getElementById("confirm-title")!,
    message: document.getElementById("confirm-message")!,
    icon: document.getElementById("confirm-icon")!,
    actions: document.getElementById("confirm-actions")!,
  };
}

/** Shows the themed modal and resolves with the id of the clicked button, or "" if dismissed. */
export function showModal(opts: ModalOptions): Promise<string> {
  const { overlay, modal, title, message, icon, actions } = els();

  title.textContent = opts.title;
  message.textContent = opts.message;
  modal.classList.toggle("confirm-danger", !!opts.danger);
  icon.classList.toggle("confirm-danger", !!opts.danger);

  actions.innerHTML = opts.buttons
    .map(
      (b) => `
      <button
        class="${b.variant === "ghost" ? "ghost-btn" : "solid-btn"} ${b.danger ? "btn-danger" : ""}"
        data-action="${escapeHtml(b.id)}"
      >${escapeHtml(b.label)}</button>`,
    )
    .join("");

  previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  overlay.classList.remove("hidden");

  const autofocusId = opts.buttons.find((b) => b.autofocus)?.id ?? opts.buttons[opts.buttons.length - 1]?.id;
  requestAnimationFrame(() => {
    const el = actions.querySelector<HTMLButtonElement>(`[data-action="${autofocusId}"]`);
    el?.focus();
  });

  wireOnce();

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

/** Save / Don't Save / Cancel — the standard unsaved-changes choice. */
export function unsavedChangesModal(opts: { title: string; message: string; saveLabel?: string }): Promise<
  "save" | "discard" | "cancel"
> {
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
  const { overlay } = els();
  overlay.classList.add("hidden");
  previouslyFocused?.focus();
  previouslyFocused = null;
  resolver?.(value);
  resolver = null;
}

function focusable(actions: HTMLElement): HTMLButtonElement[] {
  return Array.from(actions.querySelectorAll("button"));
}

function wireOnce() {
  if (wired) return;
  wired = true;
  const { overlay, actions } = els();

  actions.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
    if (btn) settle(btn.dataset.action!);
  });
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) settle("cancel");
  });
  window.addEventListener("keydown", (e) => {
    if (overlay.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      settle("cancel");
    } else if (e.key === "Enter") {
      e.preventDefault();
      const active = document.activeElement as HTMLButtonElement | null;
      if (active?.dataset.action) settle(active.dataset.action);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const btns = focusable(actions);
      if (btns.length === 0) return;
      const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.shiftKey
        ? btns[(idx - 1 + btns.length) % btns.length]
        : btns[(idx + 1) % btns.length];
      next.focus();
    }
  });
}
