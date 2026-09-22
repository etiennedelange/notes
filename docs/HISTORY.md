# History

A running log of notable work across this repo — the Notes app (`src/`,
`src-tauri/`) and the marketing site (`site/`). Newest entries first.

This is a curated summary for humans and future Claude sessions — not a
replacement for `git log`, which remains the source of truth for exact
diffs. Add an entry here after any change worth remembering the "why" of:
a feature, a fix with a non-obvious cause, a decision that closes off an
alternative, a new release.

Each entry: date, one-line summary, then a couple of bullets on what
changed and why (if the "why" isn't obvious from the commit itself), and
which part of the repo it touched (`app` and/or `site`).

---

## 2026-09-22 — Add root docs: history, enhancements, releases [app, site]

- Added `docs/` at the repo root with `HISTORY.md` (this file),
  `ENHANCEMENTS.md`, and `RELEASES.md`, covering both the Notes app and
  the marketing site, and added a root `CLAUDE.md` pointing at them.
- Why: cross-session context (decisions, deferred ideas, release state)
  was living only in commit messages and scattered "Undecided" notes in
  `PRODUCT.md`, with nowhere for it to accumulate.

## 2026-09-22 — Add Astro marketing site with GitHub Releases download integration [site]

- Built the single-page marketing/download site under `site/` on Astro 7:
  header, hero, positioning, features, themes, download, footer.
- Styled from the app's own icon palette and theme definitions rather than
  generic template defaults.
- Download section fetches the latest GitHub release for
  `etiennedelange/notes` at request/build time (`site/src/lib/github.ts`),
  classifies assets by platform, and falls back to an honest "no release
  yet" empty state.
- Commit: `5645473`.

## 2026-09-22 — Add GitHub Actions workflow for automated release process [app]

- Added `.github/workflows/release.yml`: builds and publishes a draft
  GitHub Release with Tauri installers whenever a `v*.*.*` tag is pushed
  (or via manual dispatch).
- Commit: `0ae7704`.
