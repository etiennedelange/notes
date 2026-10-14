# Changelog

All notable changes to the Notes app. Add an entry under `[Unreleased]` in
the same PR as the change; `pnpm release` dates the section, and it becomes
the release notes and the text the in-app updater shows. Newest first. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.7.1] - 2026-10-14

### Added
- **Right-click menu in the sidebar.** Right-click a note to rename it,
  delete it or show it in File Explorer. Deleted notes go to the Recycle
  Bin, and an open tab follows a rename, unsaved changes included.
  Right-click a folder to show it in File Explorer.

## [0.7.0] - 2026-10-14

### Added
- **Check for updates yourself.** The status bar shows the version of Notes
  you're running; click it to check for a newer one.

### Fixed
- Notes now checks for updates every hour, not only when it starts, so a
  copy left open finds a new release without being restarted.

## [0.6.0] - 2026-10-14

### Added
- **Right-click menu in the editor**, with Cut, Copy, Paste and Select All.
  Pasting code from it into a markdown file wraps it in a code block, the
  same as Ctrl+V.

## [0.5.0] - 2026-10-12

### Added
- **Update Notes from inside the app.** A few seconds after it starts, Notes
  checks GitHub Releases for a newer version. When there is one, an
  **Update to 0.5.0** button appears in the status bar. It offers
  **What's New** (the release page) and **Update Now**, which
  downloads the new installer, asks about any unsaved changes, and installs
  it without questions. Notes then starts again on the new version with your
  tabs restored. Updates are signed, and Notes refuses one whose signature
  doesn't match. A failed check stays quiet.

### Changed
- The download is now just the `-setup.exe` installer. Releases no longer
  include an `.msi`.

## [0.4.0] - 2026-09-26

### Fixed
- Data-loss bugs. File-access consent moved into Rust.

### Changed
- Dependency bumps (Tauri, TypeScript 7), and real app screenshots for the
  README and site.

## [0.2.0] - 2026-09-25

### Changed
- The Rust core is split out of the Tauri shell into `notes-core`.
- The window behaves less like a web page: no webview context menu, no
  HTML drags outside the editor, and no reload or devtools keys in release
  builds. Text selection is off outside the document and inputs.

## [0.1.0] - 2026-09-22

### Added
- First release of the Tauri desktop app (Windows).
