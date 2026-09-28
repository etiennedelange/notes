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
  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-in"));

  const dismiss = () => {
    el.classList.remove("toast-in");
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
