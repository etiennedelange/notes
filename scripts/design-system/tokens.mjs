// Updates the Notes design system's tokens.json from the app's themes.
//
//   pnpm design-tokens <path/to/tokens.json>          # rewrite it in place
//   pnpm design-tokens <path/to/tokens.json> --check  # exit 1 if it's out of date
//
// The design system is a claude.ai artifact (link in CLAUDE.md). Download its
// project/tokens.json, run this, then publish the file back. Only the colour
// themes and each theme colour's values are written: usage notes, the shared
// colours (backdrop and the like), type, spacing, radius and shadow are kept
// as they are, since they're written by hand.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `bgElevated` → `bg-elevated`, the design system's token names. */
export const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// ThemeTokens keys that are labels, not colours.
const NOT_COLOURS = new Set(["id", "label", "kind"]);

/**
 * Returns `tokens` with its colour themes and per-theme values taken from the
 * app's `themes` (in `order`), plus what changed. A colour the app has but the
 * file doesn't is added with a usage note to fill in.
 */
export function mergeThemes(tokens, themes, order) {
  const next = structuredClone(tokens);
  const colour = next.color;
  colour.themes = order.map((id) => ({ id, name: themes[id].label }));
  const keys = Object.keys(themes[order[0]]).filter((k) => !NOT_COLOURS.has(k));
  const added = [];
  const changed = [];
  for (const key of keys) {
    const name = kebab(key);
    const value = Object.fromEntries(order.map((id) => [id, themes[id][key]]));
    const existing = colour.tokens.find((t) => t.name === name);
    if (!existing) {
      colour.tokens.push({ name, value, usage: "TODO: say where this colour is used." });
      added.push(name);
    } else if (JSON.stringify(existing.value) !== JSON.stringify(value)) {
      existing.value = value;
      changed.push(name);
    }
  }
  // Theme colours the app no longer has. Shared colours have a plain string value.
  const known = new Set(keys.map(kebab));
  const removed = colour.tokens.filter((t) => typeof t.value === "object" && !known.has(t.name)).map((t) => t.name);
  colour.tokens = colour.tokens.filter((t) => !removed.includes(t.name));
  const themesChanged = JSON.stringify(tokens.color.themes) !== JSON.stringify(colour.themes);
  return { tokens: next, added, changed, removed, themesChanged };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [path, flag] = process.argv.slice(2);
  if (!path) {
    console.error("Usage: pnpm design-tokens <path/to/tokens.json> [--check]");
    process.exit(2);
  }
  const { THEMES, THEME_ORDER } = await import("../../src/themes.ts");
  const before = JSON.parse(readFileSync(path, "utf8"));
  const result = mergeThemes(before, THEMES, THEME_ORDER);
  const { added, changed, removed, themesChanged } = result;
  const stale = themesChanged || added.length + changed.length + removed.length > 0;
  if (themesChanged) console.log(`themes: ${THEME_ORDER.join(", ")}`);
  if (changed.length) console.log(`changed: ${changed.join(", ")}`);
  if (added.length) console.log(`added (write their usage notes): ${added.join(", ")}`);
  if (removed.length) console.log(`removed: ${removed.join(", ")}`);
  if (flag === "--check") {
    console.log(stale ? "tokens.json is out of date with src/themes.ts" : "tokens.json matches src/themes.ts");
    process.exit(stale ? 1 : 0);
  }
  if (!stale) {
    console.log("tokens.json already matches src/themes.ts");
  } else {
    result.tokens.meta = { ...result.tokens.meta, synced: new Date().toISOString().slice(0, 10) };
    writeFileSync(path, `${JSON.stringify(result.tokens, null, 2)}\n`);
    console.log(`wrote ${path}`);
  }
}
