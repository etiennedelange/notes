// Info toasts are routine ("Saved note.md") and can disappear on their own.
// Error toasts report something the user needs to notice (a failed save, a
// file that couldn't be opened), so they stay up until clicked away instead
// of vanishing on the same short timer.
export function toastDuration(kind: "info" | "error"): number | null {
  return kind === "error" ? null : 3200;
}

export function showToast(message: string, kind: "info" | "error" = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  // A manual popover lives in the top layer, above a modal dialog that's
  // already open; see raiseToasts for one that opens later.
  if (!container.matches(":popover-open")) container.showPopover();
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  container.appendChild(el);

  const dismiss = () => {
    el.classList.add("toast-out");
    setTimeout(() => el.remove(), 200);
  };

  const duration = toastDuration(kind);
  if (duration === null) {
    el.title = "Click to dismiss";
    el.addEventListener("click", dismiss, { once: true });
  } else {
    setTimeout(dismiss, duration);
  }
}

/**
 * The top layer stacks in the order things opened, so a modal opened after
 * a toast would blur it out behind its backdrop. Bring any toasts back to
 * the top, so an error is still readable. (It can't be clicked away until
 * the modal closes: a modal dialog makes everything outside it inert.)
 */
export function raiseToasts() {
  const container = document.getElementById("toast-container");
  if (!container?.matches(":popover-open") || !container.hasChildNodes()) return;
  container.hidePopover();
  container.showPopover();
}
