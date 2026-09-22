# Release History

Tracks published releases of the Notes app
(`github.com/etiennedelange/notes`), built and published by the `v*.*.*` tag
workflow in `.github/workflows/release.yml`. The GitHub release itself
remains the source of truth for assets and full notes — this file is a
quick local reference so a session doesn't need to hit the GitHub API to
know what's currently live, and so app and site work can be cross-checked
against what's actually shipped.

The marketing site (`site/`) has no independent release/versioning of its
own yet (no deploy target is configured — see `ENHANCEMENTS.md`); its
Download section just reflects whatever is listed here in real time via
the GitHub Releases API.

Update this when a new tag is released: add an entry with the version,
date, and a one-line summary of what shipped, then check whether the
Download section's platform-classification logic
(`site/src/lib/github.ts`) still handles the new release's asset naming.

## v0.1.0 — 2026-09-22

First public release.

- First release of the Tauri desktop app.
- Assets: `Notes_0.1.0_x64-setup.exe`, `Notes_0.1.0_x64_en-US.msi` (Windows
  only at this release — no macOS/Linux build yet; see `ENHANCEMENTS.md`).
- Full notes: https://github.com/etiennedelange/notes/releases/tag/v0.1.0
