// pnpm test:scripts (node --test)
import assert from "node:assert/strict";
import { test } from "node:test";
import { kebab, mergeThemes } from "./tokens.mjs";

const themes = {
  a: { id: "a", label: "A", kind: "dark", bg: "#000000", bgElevated: "#111111" },
  b: { id: "b", label: "B", kind: "light", bg: "#ffffff", bgElevated: "#eeeeee" },
};
const file = () => ({
  color: {
    themes: [{ id: "a", name: "A" }],
    tokens: [
      { name: "bg", value: { a: "#000000" }, usage: "Ground." },
      { name: "old", value: { a: "#123456" }, usage: "Gone from the app." },
      { name: "backdrop", value: "rgba(0, 0, 0, 0.35)", usage: "Shared." },
    ],
  },
});

test("names theme keys the way the design system does", () => {
  assert.equal(kebab("bgElevated"), "bg-elevated");
  assert.equal(kebab("fg"), "fg");
});

test("writes every theme's values and keeps usage notes", () => {
  const { tokens, changed, added, removed, themesChanged } = mergeThemes(file(), themes, ["a", "b"]);
  assert.equal(themesChanged, true);
  assert.deepEqual(tokens.color.themes, [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ]);
  const bg = tokens.color.tokens.find((t) => t.name === "bg");
  assert.deepEqual(bg, { name: "bg", value: { a: "#000000", b: "#ffffff" }, usage: "Ground." });
  assert.deepEqual(changed, ["bg"]);
  assert.deepEqual(added, ["bg-elevated"]);
  assert.deepEqual(removed, ["old"]);
});

test("leaves shared colours alone", () => {
  const { tokens } = mergeThemes(file(), themes, ["a", "b"]);
  assert.equal(tokens.color.tokens.find((t) => t.name === "backdrop").value, "rgba(0, 0, 0, 0.35)");
});

test("reports nothing when the file already matches", () => {
  const once = mergeThemes(file(), themes, ["a", "b"]).tokens;
  const again = mergeThemes(once, themes, ["a", "b"]);
  assert.equal(again.themesChanged, false);
  assert.deepEqual([...again.changed, ...again.added, ...again.removed], []);
});
