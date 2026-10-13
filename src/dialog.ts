/**
 * Calls `handler` when a press lands on a modal `<dialog>`'s backdrop.
 *
 * A click on `::backdrop` is dispatched to the dialog itself, and so is a
 * click on the dialog's own padding, so the target alone can't tell them
 * apart; the press point being outside the dialog's box can.
 */
export function onBackdropPress(dialog: HTMLDialogElement, handler: () => void) {
  dialog.addEventListener("mousedown", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) handler();
  });
}
