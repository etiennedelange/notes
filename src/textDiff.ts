/** A single replacement turning one string into another, in CodeMirror's change shape. */
export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * The smallest single replacement that turns `before` into `after`: the
 * span between their common prefix and common suffix. Applying a reload
 * this way, rather than replacing the whole document, keeps the cursor
 * and scroll position wherever the text around them didn't change.
 * Returns null when the strings are equal.
 */
export function minimalChange(before: string, after: string): TextChange | null {
  if (before === after) return null;
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  // Don't split a surrogate pair: back off to before its high half.
  if (start > 0 && isHighSurrogate(before.charCodeAt(start - 1))) start--;
  let end = 0;
  while (end < max - start && before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)) {
    end++;
  }
  if (end > 0 && isLowSurrogate(before.charCodeAt(before.length - end))) end--;
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}

function isHighSurrogate(code: number) {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number) {
  return code >= 0xdc00 && code <= 0xdfff;
}
