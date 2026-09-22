# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Visitors deciding whether to download and try Notes — the same persona the app itself is built for (see `## Users` in the root `PRODUCT.md`), encountered here in the "evaluating from outside" situation rather than mid-use: a developer/power user currently bouncing between Notepad++, Obsidian, and a bare VS Code workspace for quick `.txt`/`.md` editing, arriving via GitHub, search, or word of mouth, and deciding in a couple of minutes whether Notes fits before downloading or moving on.

## Product Purpose

This site is the marketing/download surface for Notes (the Tauri desktop app documented in the repo-root `PRODUCT.md`, one directory up). Its job is to communicate what Notes is and isn't fast enough for a skimming visitor to self-select, then convert that understanding into a download (or a GitHub visit) for the right visitor. Success = a visitor who fits the positioning downloads the correct build for their platform; a visitor who doesn't fit self-selects out without confusion. This file records only site-specific product truth; positioning, capabilities, and roadmap for Notes itself live in the root file and are not duplicated here.

## Positioning

Inherited from the root `PRODUCT.md`: Notes sits between Notepad++ (fast but dated) and Obsidian/VS Code (powerful but vault/workspace-heavy) by refusing ownership of the user's files. This site's job is to state that positioning plainly and quickly — the spectrum framing already built into the Positioning component — not to invent new claims about the product.

## Operating Context

- Single-page static marketing site (Astro), read in one scroll: header nav, hero, positioning, features, themes, download, footer.
- The Download section is the conversion point. It calls the GitHub Releases API at render time to show the current release's per-platform installer (Windows/macOS/Linux), with secondary asset links, and falls back to a pre-1.0 empty state ("no published release yet") pointing at the releases page and at building from source — a real, currently-live state, not a hypothetical.
- Dev server runs on port 4322 (deliberately off Astro's default 4321) to avoid colliding with the sibling Tauri app's own dev tooling when both run on the same machine.
- No custom domain is set yet (see `astro.config.mjs`); the site currently has no confirmed deploy target (Cloudflare Pages/Vercel/Netlify were noted as options, not chosen). Undecided — do not assume a specific host.

## Capabilities and Constraints

- Fetches the latest GitHub release for `etiennedelange/notes` at request/build time; classifies assets into Windows/macOS/Linux by filename suffix and picks a primary installer per platform (see `src/lib/github.ts`) with a defined suffix-preference order per platform.
- No client-side JavaScript framework — plain Astro components, CSS custom properties for theming (see `src/styles/global.css`), a couple of CSS-only animations (hero reveal/cursor blink) with `prefers-reduced-motion` handling already in place.
- No search, blog, docs, or changelog pages on this site — release notes and full history are delegated to GitHub via outbound links, not reproduced here.
- No analytics, newsletter signup, or lead capture — the only conversion action is downloading a build or visiting the repo.
- Undecided: no sitemap/canonical URL setup yet (blocked on the domain decision above).

## Brand Commitments

- Product name: "Notes" (working name, per root `PRODUCT.md`), open source.
- Repo: `github.com/etiennedelange/notes` — used throughout as the canonical link for source, issues, and releases.
- Existing visual identity already implemented in code (dark navy background, teal accent, monospace headings, `public/icon.png`) is incumbent design authority for this surface; not re-decided here. `/impeccable document` can record it formally as DESIGN.md when useful.

## Evidence on Hand

- Live GitHub Releases data via the public GitHub API (real, not mocked) — the Download section reflects whatever is actually published.
- App icon at `public/icon.png`.
- No testimonials, press, case studies, or usage metrics exist; none should be fabricated.

## Product Principles

1. State the positioning (fast-but-dated vs. powerful-but-heavy, Notes in between) plainly enough that a skimming visitor self-selects in seconds.
2. The Download section must always reflect real release state, including the honest pre-1.0 "nothing published yet" case — never a placeholder that implies a release exists.
3. Keep this surface a thin, honest front door: link out to GitHub for anything (issues, full release history, source) rather than reimplementing it here.
4. Product claims, features, and roadmap are owned by the root `PRODUCT.md`; this file does not restate or diverge from them.

## Accessibility & Inclusion

No specific standard has been set for this surface. The hero's reveal/cursor animation already respects `prefers-reduced-motion`; carry that forward as the baseline for any future motion added here.
