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

/** WCAG 2 contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme contrast", () => {
  for (const theme of Object.values(THEMES)) {
    it(`${theme.id}: text tiers clear 4.5:1 on every surface`, () => {
      for (const text of [theme.fg, theme.fgMuted, theme.fgSubtle, theme.accentText, theme.dangerText]) {
        for (const surface of [theme.bg, theme.bgElevated, theme.bgHighlight]) {
          expect(contrast(text, surface), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${theme.id}: the close button's glyph clears 3:1 on its danger hover`, () => {
      expect(contrast(theme.onDangerWindow, theme.danger)).toBeGreaterThanOrEqual(3);
    });
  }
});
