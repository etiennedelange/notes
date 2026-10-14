import { describe, it, expect } from "vite-plus/test";
import { THEMES, THEME_ORDER } from "./themes";

describe("themes", () => {
  it("lists every theme in the switcher once", () => {
    expect([...THEME_ORDER].sort()).toEqual(Object.keys(THEMES).sort());
  });

  it("keys each theme by its own id", () => {
    for (const [key, theme] of Object.entries(THEMES)) expect(theme.id).toBe(key);
  });
});
