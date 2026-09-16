const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes text for interpolation into an innerHTML template, in element content
 * or inside a double-quoted attribute. File names and paths reach the sidebar,
 * tab strip and palette verbatim, and a note called `<img onerror=...>.md` is a
 * legal file name on every platform this ships to.
 *
 * This lives in one place on purpose: four copies of a security primitive is one
 * edit away from three of them drifting.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}
