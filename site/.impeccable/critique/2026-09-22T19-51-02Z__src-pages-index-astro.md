---
target: marketing site homepage
total_score: 26
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
target_identity: "file:/workspaces/notes/site/src/pages/index.astro"
target_fingerprint: "sha256:6ddd883944a6fe1b23ea2a4ab82a949b06908bf2b7532396c4cd5cc39f5cb1a5"
target_path: /workspaces/notes/site/src/pages/index.astro
timestamp: 2026-09-22T19-51-02Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design-review subagent · B: detector+browser-evidence subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Server-rendered, so status is mostly moot; real release state (version/date or honest empty state) is shown truthfully |
| 2 | Match System / Real World | 4/4 | Copy matches the target developer's mental model precisely (quick-open, file paths, status-bar theme names) |
| 3 | User Control and Freedom | 3/4 | No modals/traps, but outbound GitHub links open in the same tab with no warning — leaving loses the page |
| 4 | Consistency and Standards | 4/4 | Button/heading/border language applied identically everywhere, matching DESIGN.md's own rules |
| 5 | Error Prevention | 2/4 | Windows/macOS/Linux download buttons render as identical, equally-weighted primaries with no OS-aware default |
| 6 | Recognition Rather Than Recall | 4/4 | Shortcut shown inline (Ctrl+P), themes shown visually, nav labeled plainly |
| 7 | Flexibility and Efficiency | n/a | Single-scroll, one-time-read marketing page — no repeated workflow to accelerate |
| 8 | Aesthetic and Minimalist Design | 3/4 | Restrained and confident execution of the documented system; docked slightly for monotone section-to-section pacing |
| 9 | Error Recovery | 3/4 | The one real "error" state (no release yet) is handled with clear copy and two alternate actions |
| 10 | Help and Documentation | n/a | Deliberately delegated to GitHub by product principle (PRODUCT.md), not reproduced in-page |
| **Total** | | **26/32** | **Good** |

Two heuristics scored n/a: this is a Persuade-mode, single-scroll marketing page with no repeated-use workflow and a stated product principle of delegating documentation to GitHub rather than reproducing it — both genuinely don't apply here, not gaps being excused.

## Design Specificity Verdict

**LLM assessment**: The page is specific in *content* but generic in *form*. Several details are genuinely load-bearing and hard to transplant to another product: the hero's editor-window mock is a literal rendering of the real UI (three tabs, a dirty-change dot, a status bar reading the real file path and theme name), the `Ctrl+P` chip ties to an actual shortcut, the Features list names real mechanisms instead of generic benefit language, and the Positioning spectrum encodes the product's actual competitive claim. These would not survive being copy-pasted onto an unrelated dev-tool site.

But the *composition* is the default modern dev-tool template: kicker → mono headline → subhead → two-button CTA → floating product mock → single-column feature list → three-card grid → CTA → thin footer. Monospace-headline-on-navy-with-one-teal-accent is a genre convention for "developer tool" now, not a distinctive mark of this specific product. A product whose whole pitch is "fast, low-ceremony, no vault" is communicated only through what the copy *says*, never through how the page itself *behaves* — it shares the same unhurried, generously-spaced scroll rhythm as the SaaS landing pages it's positioned against.

**Deterministic scan**: The CLI detector (`impeccable detect --json`) returned 33 advisory findings (`design-system-font-size`: 15, `design-system-color`: 14, `design-system-radius`: 4). Cross-checking every finding against DESIGN.md's own documented ranges and prose, 18 of the 33 are false positives — the detector only diffs against the frontmatter YAML block and misses prose-documented ranges (Label tier 0.72–0.85rem, the hairline-border "6–18% white" rule, the exact `components.button-primary` values). The remaining **15 are genuine drift**: an undocumented "in-between" font-size tier (0.9–0.95rem) recurring across 7 files that sits on no rung of the documented Label/Body scale, the Download version tag rendering at 1.1rem despite DESIGN.md explicitly classing "version tags" as Label-tier (0.72–0.85rem), two undocumented background-fill colors on the hero's skeleton mock lines, and a theme card using a black border where the system's own rule says borders are "uniformly white" (plausibly deliberate, since a white hairline would vanish against light theme cards — but undocumented as an exception).

**Browser overlay** (injection succeeded): the live detector overlay independently flagged 3 real anti-patterns — two instances of `dark-glow` ("glowing shadow accents," the wordmark dot's zero-offset teal box-shadow) and one `blinking-cursor` ("decorative blinking cursor... a fake typing cursor with no real input," the hero's cursor). A fourth flagged item (`text-occlusion`) was confirmed to be a self-referential artifact — the detector's own overlay label getting re-scanned — and is excluded. Notably, this deterministic "generic AI-UI pattern" signal **independently converges** with the LLM review's design-specificity verdict: both landed on the hero's blinking cursor as the page's most generic, templated move, even though DESIGN.md documents it as a deliberate signature component tied to the product's "text cursor" metaphor. The glow and cursor are used sparingly and are product-grounded in intent, but they are also the exact visual signature that reads as "default AI-generated dev-tool UI" to an automated pattern-matcher — worth treating as a genuine tension to resolve deliberately, not dismiss as a false positive.

## Overall Impression

A disciplined, well-executed implementation of a real, specific design system (DESIGN.md's "Paper Terminal") that nonetheless reads as a very good example of a *category*, not a page nobody else could have made. The strongest material — the literal editor mock, the honest empty-release state, the competitive-positioning spectrum — is buried in content and structure rather than expressed through how the page behaves. The single biggest opportunity: the page's own pacing and interaction model never demonstrate "fast, low-ceremony," they only claim it in copy, while the one moment that matters most for conversion (Download) currently sends 100% of visitors to an anticlimax.

## What's Working

1. **The hero editor mock** (`Hero.astro` `.mock`) — a literal, specific rendering of the actual product (three tabs, a dirty-change dot, a real file path and theme name in the status bar) rather than generic abstract hero art. It makes "point it at a file and start typing" concrete in the same glance as the headline.
2. **The honest Download empty state** (`Download.astro`) — actually shipping the documented principle ("never a placeholder that implies a release exists") is rare integrity for a marketing site, and it's paired with two real alternate actions rather than a dead end.
3. **The Positioning spectrum** (`Positioning.astro`) — compresses the product's specific competitive claim into one glanceable visual, directly serving the stated job of letting a skimming visitor self-select in seconds.

## Priority Issues

**[P0] The site's only CTA currently leads to a dead end.**
**Why it matters**: The hero's primary button ("Download Notes") and the nav's "Download" link both promise a download that, in the page's real live state right now, doesn't exist — every visitor who acts on the strongest CTA on the page hits "No published release yet." This is a trust violation at the exact moment a visitor commits to acting, and per the peak-end rule it disproportionately colors the whole visit since it's also the last thing before the footer.
**Fix**: Make the primary CTA state-aware — when `release` is null, change the hero/nav CTA label and destination (e.g. "Get Notes" → "Watch on GitHub" or "Build from source") instead of promising a download that isn't there yet.
**Suggested command**: `/impeccable onboard` (or `/impeccable clarify` for the copy change alone)

**[P1] Download platform buttons offer no error prevention.**
**Why it matters**: Once a release exists, `Download.astro`'s Windows/macOS/Linux buttons render as three identically-styled, equally-weighted `.btn-primary` elements with no OS detection or visual default — a visitor must read and choose among three same-weight teal buttons to find their own platform, and can easily grab the wrong installer.
**Fix**: Detect the visitor's OS and visually promote the matching button (reorder first and/or label "recommended"), demoting the other two to ghost style. This also better honors DESIGN.md's own Single Accent Rule by spending the one accent on the one relevant action instead of three at once.
**Suggested command**: `/impeccable harden`

**[P1] Features list fails its own chunking rule.**
**Why it matters**: `Features.astro` presents 6 items in one flat list with no sub-grouping, despite an implicit taxonomy (editing workflow / content awareness / environment) that could chunk them into groups of ≤4. Cognitive-load checklist scored 2 hard failures (chunking, minimal-choices-at-Download) plus 1 borderline (one-thing-at-a-time, also at Download) — concentrated in exactly the two sections doing the most persuasive/conversion work.
**Fix**: Introduce 2-3 light sub-groups (spacing + a small subhead is enough) so the list reads as chunks, not a wall.
**Suggested command**: `/impeccable layout`

**[P2] An undocumented "in-between" type tier has crept into the system.**
**Why it matters**: The deterministic scan independently confirmed 7 files using 0.9–0.95rem font sizes that sit on no documented rung between Label (0.72–0.85rem) and Body (1.05rem) — `Download.astro`, `Footer.astro`, `Header.astro`, `Positioning.astro`, `Themes.astro`, `global.css`. Separately, `Download.astro`'s version tag renders at 1.1rem despite DESIGN.md explicitly classing "version tags" as Label-tier — a real, measurable deviation from the system's own stated rule, not a false positive. This is the earliest sign of the type scale drifting into an ungoverned middle tier.
**Fix**: Either promote 0.9–0.95rem to a named third type-scale step, or resolve each instance back onto Label/Body; fix the version tag to sit within its documented Label range.
**Suggested command**: `/impeccable typeset`

**[P2] Mobile header nav has small, unpadded tap targets.**
**Why it matters**: At 390px width, `Header.astro`'s `.nav a` links ("Features," "Themes," "Download," "GitHub") sit with only `0.85rem` gaps and text-only hit areas with no vertical padding — a real mis-tap risk for a thumb on a moving train, and below the ~44px minimum tap-target guidance (WCAG 2.5.5).
**Fix**: Give nav links explicit padding (~44px min tap height) or collapse to a menu affordance below ~420px.
**Suggested command**: `/impeccable adapt`

## Persona Red Flags

**Jordan (Confused First-Timer)**: Clicks the hero's "Download Notes" button — the single most prominent CTA on the page — and lands on "No published release yet," directly contradicting the button's promise. Separately, the Positioning spectrum's marker sits at a hardcoded `left: 32%` with no explanation of what's being measured; a literal-minded first-timer may read it as a quantified benchmark rather than illustrative placement.

**Casey (Distracted Mobile User)**: Header nav links are bunched with ~13px gaps and no tap padding (see P2 above) — easy mis-tap while skimming one-handed. The hero's editor mock — the single most concrete "here's the real product" visual on the page — sits below both CTA buttons and shrinks its status-bar text to roughly 11-12px at 390px width, making the one piece of concrete proof hardest to read exactly where attention is shortest.

**Sam (Accessibility-Dependent User)**: No `<main>` landmark anywhere in `Layout.astro` — the body goes straight from `<header>` into a sequence of unlabeled `<section>`s, so a screen-reader or keyboard user must tab through the full header nav (5 stops) before ever reaching page content, on every visit (WCAG 2.4.1). The hero mock uses `role="img"` with an aria-label but its DOM still exposes nested text nodes in the accessibility tree, an inconsistent AT behavior risk. The `kbd` shortcut chip's boundary (a 0.16-alpha fill plus a low-opacity hairline) is close to imperceptible against Ink Navy for a low-vision user.

## Minor Observations

- The hero mock's status bar reads "Tokyo Night," but the mock's accent line uses the site's own Cursor Teal, not Tokyo Night's actual accent (`#7aa2f7` per `Themes.astro`) — the mock doesn't actually preview what it claims to show.
- Link treatment for the same destination (the repo) is inconsistent across three places: underlined inline text in the footer sentence, plain no-underline in the footer's link row, and plain no-underline in the header nav.
- Outbound GitHub links ("View source," header "GitHub," footer links) open in the same tab with no `target="_blank"` or external-link cue — a visitor who wants to quickly check repo activity loses the marketing page entirely.
- `icon.png` is reused unmodified for favicon, apple-touch-icon, and `og:image` — fine at its current size, but will render as a small square icon rather than a proper social preview card if the page is shared.
- Detector-confirmed micro-drift, low stakes: `Features.astro`'s inline-code chip uses 4px radius against the sibling `kbd` chip's documented 5px; a few decorative skeleton bars (`.mock-line`, `.card-lines span`) use 2-4px radius, off the documented 5/8/10px scale — plausible as a deliberate proportional choice for sub-8px elements, but currently undocumented as an exception.
- The Positioning section alone spends the "single accent" across four things at once (marker dot, marker glow, marker label text, and the closer pull-quote's left border) — worth a second look against DESIGN.md's own Single Accent Rule.

## Questions to Consider

- If Download can legitimately show "nothing here yet" to 100% of today's visitors, is "Download Notes" really the right hero CTA right now — or should the honest primary conversion, until v1.0 ships, be "Watch on GitHub" or "Build from source," with Download demoted to secondary?
- The page spends its one accent color on a marker placed at an arbitrary 32% along an unlabeled axis — what would it look like to replace that abstraction with a number a developer could verify in ten seconds themselves (a real cold-start time, a real binary size)?
- If the product's whole pitch is "fast, low-ceremony, no vault," should the page itself demonstrate speed and low ceremony through its own pacing — denser, faster to read — rather than sharing the same generously-spaced, slow-scroll rhythm as the SaaS landing pages it's positioned against?
