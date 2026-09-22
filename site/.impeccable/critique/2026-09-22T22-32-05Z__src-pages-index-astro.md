---
target: marketing site homepage (src/pages/index.astro)
total_score: 26
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
target_identity: "file:/workspaces/notes/site/src/pages/index.astro"
target_fingerprint: "sha256:f23b6123cb16a9bf8092743239fea4d2c66a52c9b6729641d2c5c789821df032"
target_path: /workspaces/notes/site/src/pages/index.astro
timestamp: 2026-09-22T22-32-05Z
slug: src-pages-index-astro
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Download's found/empty/error states are honest and current; docked for the scroll-spy nav bug actively showing false status |
| 2 | Match System / Real World | 4 | Fluent in the target dev-persona's language throughout |
| 3 | User Control and Freedom | 3 | No modals/traps, GitHub escape hatch everywhere; no skip-link, minor |
| 4 | Consistency and Standards | 3 | Strong system adherence; docked for the nav active-state bug contradicting its own stated behavior, and group-labels not being real headings |
| 5 | Error Prevention | 3 | Empty-vs-error distinction in Download is the standout — prevents "is this broken or just unreleased" confusion |
| 6 | Recognition Rather Than Recall | 3 | Good visual grouping; docked because Features' group-labels are invisible to heading-based navigation |
| 7 | Flexibility and Efficiency | n/a | No repeat-use workflow on a single-scroll landing page |
| 8 | Aesthetic and Minimalist Design | 4 | Strongest score — one accent, two-tier text, flat-by-default, executed with real discipline |
| 9 | Error Recovery | 3 | GitHub-fetch error branch gives plain-language explanation plus two concrete recovery paths |
| 10 | Help and Documentation | n/a | Single-scroll marketing page; GitHub is the intentional doc doorway |
| **Total** | | **26/32** | **Good (81%)** |

## Design Specificity Verdict

**LLM assessment:** Pass, distinctly. "Paper Terminal" is a specific, coherent world — the mono/sans split by literalness, the single teal accent, flat hairline-bordered surfaces with exactly one real drop-shadow reserved for the hero mock, the fast-vs-heavy spectrum diagram instead of a features table. Every border-radius value in the shipped CSS was checked against the documented 5/8/10 scale and found clean — the snapping fix from the last round landed with no stragglers.

**Deterministic scan:** `impeccable detect --json`: exit 0, 36 advisory findings (design-system-color: 26, design-system-font-size: 10) — down from 40 last run, with design-system-radius now producing zero findings, confirming that fix held. Most remaining findings are false positives on inspection: 18 of the 26 color findings are Themes.astro's intentional per-editor-theme swatch colors, and the font-size findings mostly sit inside DESIGN.md's documented 0.72–0.85rem Label range that the frontmatter schema doesn't capture.

**Visual overlays:** A real overlay was confirmed live. Three real findings: the wordmark dot's dark-glow and the hero's blinking-cursor — both DESIGN.md-documented signature moves (Halo glow, Hero Cursor), not defects. A fourth finding (text-occlusion) was confirmed as a self-referential artifact — the detector's own injected label being re-scanned — verified by grepping the source tree for the flagged string with zero matches.

## Overall Impression

The reliability and mobile fixes from the last round genuinely landed: the empty/error split in Download reads as real trust-building work, the border-radius drift is fully closed, and 320px no longer breaks the page layout. But this round surfaces a real regression introduced by that same work: the new scroll-spy nav indicator gets stuck showing the wrong section on the single most natural "I'm done browsing" action — scrolling to the bottom and clicking the logo to jump back to the top. The score holds flat at 26/32 for the same reason it did last time: fixed issues were offset by newly-surfaced ones, this time including one shipped in the last fix round.

## What's Working

1. **Empty vs. error distinction in Download** (src/lib/github.ts) — splitting a 404 ("empty") from a network/5xx failure ("error") with distinct, honest copy for each is real discipline most marketing sites skip entirely.
2. **Border-radius scale discipline** — every radius in the shipped CSS now traces cleanly to the documented 5/8/10px scale; the fix held with no exceptions found.
3. **The hero cursor-blink** — a single, purposeful motion moment exactly where DESIGN.md says motion should live, with a correct prefers-reduced-motion all-or-nothing fallback.

## Priority Issues

**[P1] Scroll-spy active nav link gets stuck on the wrong section**
- Why it matters: Header.astro's IntersectionObserver only sets aria-current when a tracked section (features/themes/download) intersects — there's no branch to clear it when none do, and #top (the hero) is never itself observed. Reproduced deterministically: scroll to Download, click the "notes" wordmark to jump to #top — the page correctly scrolls to the hero, but "Download" stays lit teal in the nav indefinitely. Any visitor who reads to the bottom and taps the logo — an entirely ordinary action on a one-page site — sees a nav actively lying about where they are.
- Fix: track #top as an observed section (or clear all aria-current when nothing is intersecting).
- Suggested command: /impeccable polish

**[P2] Features section's sub-group labels aren't real headings**
- Why it matters: group.label renders as a `<p>`, not `<h3>`. The only headings on the page are the h1 and four h2 section titles — nothing marks the three feature groupings for anyone navigating by heading, a primary screen-reader pattern, on the one part of the page with non-linear structure.
- Fix: change `<p class="group-label">` to `<h3 class="group-label">` — no CSS change needed.
- Suggested command: /impeccable polish

**[P2] Hero mock tabs still clip abruptly at 320px**
- Why it matters: the ellipsis fix from last round isn't winning against three roughly-equal-width tabs in ~260px — scratch.txt still hard-clips at the mock's rounded corner with no visible ellipsis. This is the one piece of "here's what the product actually looks like" evidence on the page, at the exact viewport last round's fixes targeted.
- Fix: either let .mock-tabs scroll horizontally, or collapse to two visible tabs with a "+1" affordance below a breakpoint.
- Suggested command: /impeccable adapt

**[P3] Uniform inter-section rhythm reads as a lot of "dead" scrolling**
- Why it matters: every section uses the same padding regardless of content density — the one-line Themes lede gets the same breathing room as the denser Features list — so a visitor scrolls ~4300px at mobile width for six short ideas with no sense of acceleration toward the one actual ask.
- Fix: judgment call, not a bug — consider tightening gaps slightly as sections approach Download to add momentum toward the CTA.
- Suggested command: /impeccable layout

## Persona Red Flags

**Jordan (Confused First-Timer)**: Reads hero → sub → positioning spectrum in well under a minute. Red flag: scrolls to Download, sees "No published release yet," taps the logo to reconsider from the top — the nav falsely claims they're still on "Download," a small trust wobble at exactly the moment they're deciding whether "build from source" is worth the effort.

**Riley (Stress Tester)**: Finds the 320px hero-mock tab clip immediately. Finds the scroll-spy stuck-state within seconds of using the logo as a "back to top" shortcut. Nothing breaks outright — no horizontal scroll, no console errors — the site survives, just not spotlessly.

**Casey (Distracted Mobile User)**: Header nav at 320px now fits on one line without wrapping — the prior fix holds. Same hero-mock clip as Riley hits her too, right below the fold-adjacent CTA, on the exact width most likely to be her real device.

## Minor Observations

- Contrast is uniformly strong: cloud-on-navy 8.73:1, paper-on-navy 15.78:1, teal-on-navy 9.72:1, button text-on-teal 9.16:1 — all clear AA with real margin, several AAA.
- No horizontal scroll and no console errors/warnings at 1440/390/320px — clean baseline.
- No skip-link before the header nav; low priority for a 4-link single-page site.
- "Build it from source" links to ${REPO_URL}#building — not verified whether that anchor exists in the actual README; worth a quick manual check.

## Questions to Consider

- The empty Download state is doing excellent honesty work, but it's also the last thing every visitor sees before deciding to leave — should pre-1.0 visitors get something with more momentum (a GitHub star/watch prompt) instead of ending on an absence?
- Was the "return to top" path actually exercised when the scroll-spy fix was verified last round, or was testing limited to the forward/downward scroll the intersection band was tuned for?
