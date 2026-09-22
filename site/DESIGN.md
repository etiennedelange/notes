---
name: Notes marketing site
description: Marketing/download site for Notes, a fast, low-ceremony desktop editor for .txt and .md files
colors:
  cursor-teal: "#2dd4bf"
  cursor-teal-dim: "rgba(45, 212, 191, 0.35)"
  ink-navy: "#12161f"
  ink-navy-raised: "#1a2030"
  warm-paper: "#f6efdd"
  cloud-grey: "#aeb4c4"
  cloud-grey-dim: "rgba(174, 180, 196, 0.16)"
typography:
  display:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "clamp(1.9rem, 4.6vw, 3.1rem)"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 1.9rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    letterSpacing: "normal"
rounded:
  sm: "5px"
  md: "8px"
  lg: "10px"
components:
  button-primary:
    backgroundColor: "{colors.cursor-teal}"
    textColor: "#06201c"
    rounded: "{rounded.md}"
    padding: "0.8em 1.3em"
  button-primary-hover:
    backgroundColor: "#4de3d1"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.warm-paper}"
    rounded: "{rounded.md}"
    padding: "0.8em 1.3em"
---

# Design System: Notes marketing site

## Overview

**Creative North Star: "The Paper Terminal"**

Warm cream text — literally named "paper" in the codebase — sits on a deep navy canvas, lit by a single spark of teal, with monospace flashing in only at moments that are structurally literal: a headline, a keyboard shortcut, a file path, a version number. It reads as ink on paper crossed with a terminal, which is exactly the product's own lineage: a fast, low-ceremony editor for `.txt`/`.md` files that refuses to dress itself up as either a glossy consumer app or a heavyweight IDE.

The system is deliberately quiet. Density is generous — one idea per section, a single reading column, ample vertical rhythm — and confidence comes from restraint rather than ornament. There are no gradients, no glassmorphism, no multi-color palette, and almost no shadows; separation is drawn with hairline borders, not elevation. Motion is minimal and purposeful: a single reveal-and-blink on the hero headline, understated hover lifts on buttons, nothing else. Where competitors' marketing sites reach for glow and bounce, this one reaches for precision.

**Key Characteristics:**
- One accent color, spent sparingly, never doubled up with a second hue.
- Two-tier text: warm paper for headings and emphasis, cool cloud grey for everything else.
- Monospace marks signal (shortcuts, file paths, versions, the headline); sans carries all prose.
- Flat by default; shadow and glow are reserved, not decorative defaults.
- A single deliberate motion moment (the hero cursor) rather than motion sprinkled throughout.

## Colors

A two-tone dark canvas — navy background, paper and cloud text — carrying exactly one spark of color, spent on only a handful of elements per screen.

### Primary
- **Cursor Teal** (`#2dd4bf`): the system's only accent. Used on primary CTA buttons, the focus-visible outline, the hero's blinking text cursor, the header wordmark's glow dot, the positioning spectrum's marker dot and glow, one accent line inside the hero's editor mock, and the release version tag.
- **Cursor Teal Dim** (`rgba(45, 212, 191, 0.35)`): the halo/glow cast by Cursor Teal — never a fill on its own, always a soft ring or line tint behind or beside the solid accent.

### Neutral
- **Ink Navy** (`#12161f`): the page background; every section sits directly on this.
- **Ink Navy Raised** (`#1a2030`): one step lighter, used for surfaces that sit above the page — the hero's floating editor mock, status-bar chrome inside it.
- **Warm Paper** (`#f6efdd`): headings and high-emphasis text only — section titles, the hero line, the Positioning section's pull-quote, primary nav wordmark.
- **Cloud Grey** (`#aeb4c4`): supporting/secondary text — intro/lede copy, body paragraphs, nav links, captions, footer text.
- **Cloud Grey Dim** (`rgba(174, 180, 196, 0.16)`): subtle fill for inline code and `kbd` shortcut chips — the only place a neutral gets a background fill instead of staying transparent.

### Named Rules
**The Single Accent Rule.** Cursor Teal appears on a small, countable set of elements per screen — never a second hue, never a gradient. Its rarity is what makes it read as a cursor rather than decoration.

**The Two-Tier Text Rule.** Warm Paper is reserved for headings and one emphasized moment per section (a pull-quote, a wordmark); everything else — all supporting copy, links, captions — runs in Cloud Grey. Promoting more text to Warm Paper dilutes the emphasis it's meant to carry.

## Typography

**Display Font:** JetBrains Mono (with ui-monospace, SF Mono, Menlo fallback)
**Body Font:** IBM Plex Sans (with system-ui fallback)
**Label/Mono Font:** JetBrains Mono, shared with Display, dropped to small sizes for kickers, keyboard-shortcut chips, status-bar text, and version tags.

**Character:** Sans carries every sentence of prose; mono is reserved for moments that are structural or literal rather than expressive — it announces the product's editor lineage without ever narrating in it.

### Hierarchy
- **Display** (500, `clamp(1.9rem, 4.6vw, 3.1rem)`, 1.3 line-height, -0.01em tracking): the hero line only. Mono, Warm Paper, revealed with a clip-path wipe and finished by a blinking cursor.
- **Headline** (600, `clamp(1.5rem, 3vw, 1.9rem)`, 1.3 line-height, -0.01em tracking): section titles ("Where Notes sits", "What it does", "Three themes, switchable live", "Download"). Sans, Warm Paper.
- **Body** (400, 1.05rem intro/lede copy or 16px/1.6 base running text): Cloud Grey, capped at roughly 42–58ch per section for reading comfort.
- **Caption** (400, 0.9rem, sans): secondary sans-serif text that's smaller than Body but isn't a mono signal — nav links, footer text, button labels, the release date, and the "see all releases" link. Cloud Grey unless otherwise noted.
- **Label** (400, 0.72–0.85rem, mono, normal tracking): kickers, `kbd` shortcut chips, status-bar text, version tags, theme-card names and notes. 0.85rem is the tier's ceiling — nothing mono-labeled goes larger, even a value like a release version that feels like it deserves more weight; reach for Cursor Teal or the Mono-For-Signal placement itself for emphasis instead of breaking the ramp.

### Named Rules
**The Mono-For-Signal Rule.** JetBrains Mono is used only for content that is structurally literal — the hero headline, keyboard shortcuts, file paths, version numbers, status-bar text. It never sets ordinary prose.

## Layout

Everything sits inside a 64rem (`--wide-width`) centered container with responsive side gutters (`clamp(1.25rem, 5vw, 4.5rem)`). Section vertical rhythm runs `clamp(3.5rem, 9vw, 6.5rem)` top and bottom, tighter in the hero (`clamp(2rem, 6vw, 3.5rem)` / `clamp(3rem, 8vw, 5rem)`). Base type is 16px at 1.6 line-height.

The page is a single reading column top to bottom — header, hero, positioning, features, themes, download, footer — with exactly two structural departures: the Features list becomes a two-column `11rem 1fr` label/description grid (collapsing to one column under 34rem), and the Themes section becomes a 3-column equal grid (collapsing to one column under 40rem). Header and footer are simple flex rows, space-between, wrapping on narrow viewports.

## Elevation & Depth

Flat by default. Almost every surface sits directly on Ink Navy with no shadow at all; separation is drawn with a hairline border, not elevation. Two departures are deliberate, not accidental: a soft teal halo/glow marks a few specific points of attention (the wordmark dot, the positioning spectrum's marker), and a single real drop-shadow lifts the hero's floating editor-window mock off the page — the one object on the site depicting something that actually floats.

### Shadow Vocabulary
- **Halo glow** (`box-shadow: 0 0 8px 1px var(--teal-dim)` on the wordmark dot; `0 0 0 5px var(--teal-dim)` as a ring on the spectrum marker): marks a point of attention, never a whole surface.
- **Hero float** (`box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.6)`): reserved for the editor-window mock — the system's one depiction of the actual product floating above the page.

### Named Rules
**The Flat-Unless-Floating Rule.** A surface earns a shadow only when it depicts something that physically floats (the product's own window). Cards, rows, and buttons stay flat and separate with a hairline border instead.

## Shapes

Corner radius runs a small, consistent scale: 5px for `kbd` shortcut chips, 8px for buttons, 10px for the hero's editor mock and the theme cards — never sharp, never pill-shaped. Borders are uniformly a single 1px hairline of white at low, varying opacity (roughly 6–18%) laid directly on Ink Navy; there is no separate border-color token, so every border reads as a translucent cut into its surface rather than a drawn line.

## Components

### Buttons
- **Shape:** 8px radius (`{rounded.md}`).
- **Primary:** Cursor Teal background, `#06201c` text (a near-black teal for contrast, not a system neutral), `0.8em 1.3em` padding.
- **Hover / Focus:** primary lightens to `#4de3d1` and lifts 1px (`translateY(-1px)`, 0.15s ease); ghost's border shifts to Cursor Teal on hover, its background never fills.
- **Ghost:** transparent background, Warm Paper text, hairline border (18% white). The accent color stays exclusive to the primary action on any given screen.

### Chips / Labels
- **`kbd` shortcut chips:** mono type, Cloud Grey Dim background, hairline border with a heavier 2px bottom edge (reads as a physical key), 5px radius.
- **Version / status tags:** small mono text in Cursor Teal or Cloud Grey depending on emphasis, no background — plain inline text, not a pill.

### Cards / Containers
- **Hero editor mock:** 10px radius, Ink Navy Raised background, hairline border, the system's one real drop-shadow.
- **Theme cards:** 10px radius, filled with the represented theme's own background color (content-driven, not a system token), hairline border, no shadow.
- **Feature rows:** no container — a flat list separated by top/bottom hairline rules, not boxed.

### Navigation
- **Header:** mono wordmark with a Cursor Teal glow dot; flat text links in Cloud Grey that brighten to Warm Paper on hover; no active-state treatment, no background.
- **Footer:** same link language (Cloud Grey, no underline, brightens on hover) plus one inline sentence carrying underlined Warm Paper links.

### Hero Cursor (signature component)
A 0.5ch-wide Cursor Teal bar that appears immediately after the hero headline's clip-path reveal finishes, then blinks on a step-end timing — read as a text cursor, not a decorative flourish. `prefers-reduced-motion` disables the reveal and blink outright (the cursor simply appears solid) rather than merely slowing them down; any future motion on this surface should follow that same all-or-nothing stance.

## Do's and Don'ts

### Do:
- **Do** spend Cursor Teal on a small, countable set of elements per screen — one CTA, one glow, one accent line (**The Single Accent Rule**).
- **Do** separate surfaces with a 1px hairline border (white at 6–18% opacity) instead of a shadow or a filled card.
- **Do** reserve Warm Paper for headings and one emphasized moment per section; run supporting copy in Cloud Grey (**The Two-Tier Text Rule**).
- **Do** use JetBrains Mono only for structurally literal content — headline, shortcuts, file paths, versions, status text (**The Mono-For-Signal Rule**).
- **Do** disable motion outright under `prefers-reduced-motion`, matching the hero's existing treatment.

### Don't:
- **Don't** add a shadow to an ordinary card, row, or button — shadows are reserved for the hero's floating editor mock (**The Flat-Unless-Floating Rule**).
- **Don't** introduce a second accent color or a gradient; the palette is exactly one accent plus the navy/paper/cloud neutrals.
- **Don't** set body or supporting copy in JetBrains Mono — mono marks signal, never prose.
- **Don't** give the ghost button a background fill on hover; only its border changes.
