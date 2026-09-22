---
target: marketing site homepage (src/pages/index.astro)
total_score: 26
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/workspaces/notes/site/src/pages/index.astro"
target_fingerprint: "sha256:3b400bdf73baf1c2bedd2e0b0f2431509dcbcb6f6986e831610b516fbcc91ed4"
target_path: /workspaces/notes/site/src/pages/index.astro
timestamp: 2026-09-22T20-31-18Z
slug: src-pages-index-astro
closed: true
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Adaptive CTA copy ("Get Notes" vs "Download") is good, but a GitHub API fetch failure renders identically to a genuine "no release yet" |
| 2 | Match System / Real World | 4 | Fluent in the target dev-persona's language throughout |
| 3 | User Control and Freedom | 4 | No modals/traps; native anchors, back/forward work naturally |
| 4 | Consistency and Standards | 3 | Strong system, but breaks its own no-horizontal-scroll contract at 320px |
| 5 | Error Prevention | 3 | Fetch is try/caught, but doesn't prevent the misleading blended state |
| 6 | Recognition Rather Than Recall | 4 | Full text labels everywhere; shortcut shown inline as a kbd chip |
| 7 | Flexibility and Efficiency | n/a | No repeat-use workflow on a single-scroll landing page |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and purposeful; rhythm reads sparse around the short Download section |
| 9 | Error Recovery | 2 | The one real failure mode (GitHub API error) is silently swallowed, no distinction, no retry |
| 10 | Help and Documentation | n/a | Single-scroll marketing page; GitHub is the intentional doc doorway |
| **Total** | | **26/32** | **Good (81%)** |

## Design Specificity Verdict

**LLM assessment (Assessment A):** Authored for this product, not category-interchangeable. The hero editor mock (tabbed window, dirty-dot, status bar reading `~/notes/todo.md · Markdown · Tokyo Night`), the Notepad++↔Obsidian/VS Code positioning spectrum, the theme cards using the app's actual palette values, and the `Ctrl+P` kbd chip are all concrete artifacts of this product's real behavior — a competitor's dev-tool landing page couldn't reuse this content unchanged.

**Deterministic scan (Assessment B):** `impeccable detect --json` on `src/pages/index.astro` + its 7 imported components: exit 0, 40 advisory findings — `design-system-color` (26), `design-system-font-size` (10), `design-system-radius` (4).

Interestingly, the detector's browser-injected anti-pattern scanner flagged two of this system's most deliberate, DESIGN.md-documented signature moves as generic "slop": the wordmark dot's `dark-glow` (documented as the Halo glow shadow-vocabulary entry) and the hero's `blinking-cursor` (documented as the Hero Cursor, explicitly called out as a "signature component" with its own reduced-motion contract). This is a case where the deterministic scan disagrees with documented intent — the design wins here, not the detector; both are correctly kept, not flags to act on.

Most of the 40 static findings are false positives on closer read:
- All 19 `Themes.astro` findings are per-editor-theme swatch colors (Nord, Tokyo Night, Noctis Lux) — intentionally sourced from those external themes rather than the site's own palette, with an explicit code comment explaining why they're baked into CSS rather than tokenized.
- Most `design-system-font-size` findings (0.72rem / 0.85rem, scattered across Hero/Features/Themes/Download) actually fall inside DESIGN.md's own documented Label range ("0.72–0.85rem... 0.85rem is the tier's ceiling") — the detector is comparing against the frontmatter's single `0.8rem` token, not the prose-documented range, so these are schema gaps, not drift.
- Most `design-system-color` `rgba(255,255,255,…)` findings sit inside DESIGN.md's documented hairline-border range (6–18% opacity) — likely flagged only because there's no named token for a translucent-white border, not because the values are wrong.

**Genuine finding worth keeping:** the 4 `design-system-radius` results are real. DESIGN.md's shape scale is exactly 5px / 8px / 10px, but the code uses 4px (Hero.astro:180, Features.astro:140, Themes.astro:101) and 2px (Positioning.astro:71) — values outside the documented scale.

**Visual overlays:** A real, user-visible overlay was confirmed live in the browser (script injection succeeded, `window.impeccableDetect()` ran in-page, `div.impeccable-overlay` elements rendered over the flagged elements) before being torn down. One of the four browser-console findings — a `text-occlusion` hit on a div reading "✦ decorative blinking cu…" — was the detector re-scanning and flagging its own injected label element, not a real page defect; discarded as a self-referential artifact.

## Overall Impression

This is a well-executed, specific piece of design — not a template with the product's name swapped in. The single-accent, flat-by-default system is genuinely restrained and the cognitive load is close to ideal for a landing page. The gap between "good critique score" and "actually converts today" is narrow but real: the page's entire reason for existing is the Download section, and right now that section is silently degraded (a GitHub API hiccup reads identically to "nothing exists yet") and actively broken at the narrowest common mobile width (320px horizontal scroll).

## What's Working

1. **The hero mock and positioning spectrum are load-bearing illustration, not decoration** — they encode real product facts instead of generic placeholder UI.
2. **Contrast and focus handling are excellent** — cloud-grey-on-navy body text ~8.7:1, teal-on-navy ~9.7:1, button text ~9.2:1 (all AAA), visible `:focus-visible` ring applied globally.
3. **Copy adapts honestly to real state** — header nav and hero CTA switch between "Download Notes" and "Get Notes" depending on whether a release actually exists, so the page never overpromises.

## Priority Issues

**[P1] Fetch failure and "no release" are visually and textually identical**
- Why it matters: `getLatestRelease()` in `src/lib/github.ts` catches any fetch error and returns `null`, rendering the same "No published release yet" copy as a genuine absence of releases. A GitHub rate-limit during a traffic spike would make every visitor see a false claim that nothing exists.
- Fix: distinguish the two states; on fetch failure use neutral wording pointing at the releases page instead of asserting non-existence.
- Suggested command: /impeccable harden

**[P1] Horizontal overflow at 320px viewport width**
- Why it matters: confirmed live — scrollWidth 335px vs 320px viewport. Header GitHub link clipped, hero mock tab text cut off, page scrolls horizontally. The existing 30rem media query tightens nav gap but never allows wrapping.
- Fix: allow `.header` to wrap below ~360px, or shrink nav font/gap earlier.
- Suggested command: /impeccable adapt

**[P2] Anticlimactic peak-end at the actual live Download state**
- Why it matters: Download is the page's one conversion moment but is currently the shortest section while receiving the same generous padding as content-dense sections, compounding the honest-but-deflating pre-1.0 copy into a moment that reads sparse right where the page should close strongest.
- Fix: tighten the empty state's surrounding rhythm, or give it more presence with a short explanatory line.
- Suggested command: /impeccable layout

**[P2] No active-section indication in the anchor nav**
- Why it matters: four nav items link to in-page anchors with no indication of current section while scrolling.
- Fix: scroll-spy active state on `.nav a` (IntersectionObserver + aria-current).
- Suggested command: /impeccable polish

**[P3] Border-radius drift from the documented shape scale**
- Why it matters: DESIGN.md's scale is 5px/8px/10px; code uses 4px (Hero.astro:180, Features.astro:140, Themes.astro:101) and 2px (Positioning.astro:71).
- Fix: snap to 5px or add a documented smaller tier.
- Suggested command: /impeccable polish

## Persona Red Flags

**Jordan (Confused First-Timer)**: "Where Notes sits" assumes familiarity with Notepad++, Obsidian, and VS Code. The hero "mock" is stylized abstract bars, not a real screenshot.

**Riley (Stress Tester)**: Confirmed the 320px overflow bug live. Confirmed the fetch-conflation bug by blocking api.github.com and reloading.

**Casey (Distracted Mobile User)**: Hits the 320px horizontal-scroll bug directly. ~4100px total scroll height on mobile with multi-hundred-px gaps between short sections means more thumb-scrolling than content density justifies.

## Minor Observations

- Nav touch targets on mobile measure 47px tall — above the 44px minimum.
- The client-side OS-detection script in Download.astro only runs inside the `release &&` branch — currently dead code until a release ships; worth a manual check then.
- `prefers-reduced-motion` handling matches DESIGN.md's documented all-or-nothing rule.
- Dev-mode CSP (`security: { csp: true }`) did not block the cross-origin detector script injection during testing — not a production concern but worth knowing.
- Jargon barrier ("vault," "index database"): fine for the documented power-user persona; liable to lose a less technical visitor otherwise.

## Questions to Consider

- If the hero's whole pitch is "point it at a file and start typing," should the first thing a visitor sees be a real screenshot instead of an abstract mock?
- Should the Download section's empty state carry more visual weight than a feature row, given it's the entire reason the page exists?
- What should this page say the moment GitHub's API is unreachable, given that silence currently reads as "nothing to download"?
