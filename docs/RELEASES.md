# Release History

Tracks published releases of the Notes app
(`github.com/etiennedelange/notes`), built and published by the `v*.*.*` tag
workflow in `.github/workflows/release.yml` (cut with `pnpm release`; see
`RELEASING.md`). What changed in each version is in `CHANGELOG.md`. The GitHub release itself
remains the source of truth for assets and full notes — this file is a
quick local reference so a session doesn't need to hit the GitHub API to
know what's currently live, and so app and site work can be cross-checked
against what's actually shipped.

The marketing site (`site/`) has no independent release/versioning of its
own; its Download section reads the latest release from the GitHub
Releases API at build time. The release workflow starts a Cloudflare
Pages rebuild via `.github/workflows/site-rebuild.yml` once it publishes,
so the site picks it up within a few minutes.

Update this when a new tag is released: add an entry with the version,
date, and a one-line summary of what shipped, then check whether the
Download section's platform-classification logic
(`site/src/lib/github.ts`) still handles the new release's asset naming.

## v0.7.0 — 2026-10-14

- Notes checks for updates every hour, not only at startup, and the
  version in the status bar checks on click.
- The first update confirmed end to end: an open 0.6.0 offered 0.7.0.
- Assets as in v0.5.0.
- Full notes: https://github.com/etiennedelange/notes/releases/tag/v0.7.0

## v0.6.0 — 2026-10-14

- A right-click menu in the editor (Cut, Copy, Paste, Select All).
- Assets as in v0.5.0.
- Full notes: https://github.com/etiennedelange/notes/releases/tag/v0.6.0

## v0.5.0 — 2026-10-12

- The in-app updater: the status bar offers a newer release and installs it.
  Copies from v0.4.0 or earlier need this installer once by hand.
- Assets: `Notes_0.5.0_x64-setup.exe`, its `.sig`, `latest.json` and
  `SHA256SUMS.txt`; no `.msi` any more. `site/src/lib/github.ts` already
  matches `.exe`, so it needed no change.
- Full notes: https://github.com/etiennedelange/notes/releases/tag/v0.5.0

## v0.4.0 — 2026-09-26

First release built and published by the tag workflow rather than by hand.

- Fixed data-loss bugs and moved file-access consent into Rust.
- Dependency bumps (Tauri, TypeScript 7) and real app screenshots for the
  README and site.
- Assets: `Notes_0.4.0_x64-setup.exe`, `Notes_0.4.0_x64_en-US.msi`. Naming
  is unchanged, so `site/src/lib/github.ts` needed no change.
- Full notes: https://github.com/etiennedelange/notes/releases/tag/v0.4.0

## v0.3.0 — not released

Tagged 2026-09-26, but the workflow failed to create the release (see the
2026-09-26 `HISTORY.md` entry on `tauri-action`). The tag still exists
with no GitHub release; everything in it shipped in v0.4.0.

## v0.2.0 — 2026-09-25

Internal restructuring plus a pass at making the window stop behaving like a
web page. No new editor features.

- Split the Rust core out of the Tauri shell into `notes-core`
  (`src-tauri/core/`), which has no Tauri dependency. Groundwork for
  evaluating a non-webview UI later; see `ENHANCEMENTS.md` and the
  2026-09-25 `HISTORY.md` entry.
- Suppressed the webview context menu, blocked HTML5 drags outside the
  editor, and (in production builds only) swallowed the reload and devtools
  keys. Text selection is now off outside the document and inputs.
- Added `pnpm run release <version>` (`scripts/release.sh`) — bumps the
  three version fields, refreshes `Cargo.lock`, commits and tags, stopping
  short of the push.
- Assets: `Notes_0.2.0_x64-setup.exe`, `Notes_0.2.0_x64_en-US.msi` (still
  Windows only). Naming is unchanged from v0.1.0, and
  `site/src/lib/github.ts` classifies on suffix rather than filename, so the
  Download section needed no change.
- Full notes: https://github.com/etiennedelange/notes/releases/tag/v0.2.0

## v0.1.0 — 2026-09-22

First public release.

- First release of the Tauri desktop app.
- Assets: `Notes_0.1.0_x64-setup.exe`, `Notes_0.1.0_x64_en-US.msi` (Windows
  only at this release — no macOS/Linux build yet; see `ENHANCEMENTS.md`).
- Full notes: https://github.com/etiennedelange/notes/releases/tag/v0.1.0
