# Changelog

All notable changes to the Notes app. Add an entry under `[Unreleased]` in
the same PR as the change; `pnpm release` dates the section, and it becomes
the release notes and the text the in-app updater shows. Newest first. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Opens `.json` files** as plain text: from the Open dialog, the sidebar
  and drag and drop.

### Changed
- **Long lines wrap at the window edge** again, instead of at 80
  characters with empty space beside them.

## [0.7.5] - 2026-10-18

### Added
- **New Note in the sidebar.** A new-note button sits next to the open
  folder's name, and right-clicking a folder offers **New Note…**, so a
  note can be created right where you want it instead of via Save As.

### Fixed
- **Saving keeps a file's Windows line endings.** Files using CRLF line
  breaks were saved back with LF ones, so editing one line changed every
  line as far as Git or a sync client could tell.
- **Saving a new note starts in the open folder**, rather than wherever
  the save dialog was last, and the saved note shows up in the sidebar
  straight away.
- **New tabs are numbered** ("Untitled", "Untitled 2", ...), so the
  unsaved-changes prompt can tell them apart.
- **Closing a tab moves to the tab beside it**, not the last tab.
- **The tab menu's "Reveal" item is named for your OS** (Finder on macOS,
  "Show in Folder" on Linux), as it already was in the sidebar.
- **Files that can't be opened say so.** Dropping a file Notes can't open
  (anything but `.txt` and `.md`) shows a message instead of doing
  nothing, as does a tab from the last session whose file has since been
  moved or deleted.
- **Easier-to-read red in two places.** Red text such as a hovered
  "Delete…" menu item is a little darker in Noctis Lux, so it's legible
  on the hover highlight, and the close button's ✕ is dark on Tokyo
  Night's pink hover instead of white.
- **Saving a new note suggests a name from its first line** instead of
  always offering `Untitled.md`, so a note starting `# Shopping list`
  saves as `Shopping list.md` by default.
- **Highlighting follows the file type after Save As or Rename.** A new
  note saved as `.txt`, or a note renamed between `.md` and `.txt`, no
  longer keeps the old Markdown (or plain-text) highlighting until it's
  reopened. The status bar also now says "Markdown" for new notes,
  matching how they're edited.

## [0.7.4] - 2026-10-14

### Added
- **New theme: Noctis Hibernus.** A cool light theme, Noctis Lux's sibling,
  with the same teal text on a blue-green off-white. Pick it from the four
  swatches in the status bar.

### Changed
- **"Pinned Files" is now "Other Files", and you choose what's in it.**
  Opening or dropping a file from outside your folder no longer adds it
  to the sidebar. To keep one there, right-click its tab and choose
  **Add to Sidebar**; the list is remembered between sessions. Files
  that were listed before need adding again.
- **Markdown headings are bigger.** `#`, `##` and `###` headings now show
  at a larger size, so a note's structure is visible at a glance.
- **Text wraps at 80 characters.** Long lines wrap at a comfortable
  reading width instead of running to the edge of a wide window.
- **Easier-to-read small text.** Tab names, sidebar headings, line
  numbers and other secondary text are a little brighter in the dark
  themes and darker in Noctis Lux. The Save and Don't Save buttons, and
  error messages, also have stronger contrast.
- **Noctis Lux is less yellow.** The light theme's background, panels and
  borders keep their brightness but have about half the yellow tint.

### Fixed
- **Tabs that don't fit can be reached with the mouse wheel.** Scrolling
  over the tab bar moves it sideways, and an edge fades out when more tabs
  are hidden past it.
- **"File changed on disk" no longer overwrites on Enter.** When a file
  was changed in another app since you opened it, saving asks what to do.
  Cancel is now the default there, so pressing Enter by reflex doesn't
  replace the other app's version.
- **Saving clears the "modified" dot in the sidebar.** The dot next to a
  file in the folder and pinned lists now goes away when you save, as the
  one on the tab already did.

## [0.7.3] - 2026-10-14

### Added
- **Notes picks up changes made in other apps.** When you switch back to
  Notes, any open note without unsaved changes is updated to match the
  file on disk, keeping your cursor where it was. Notes with unsaved
  changes are left alone, and saving one still asks before overwriting
  the newer file.

### Fixed
- **Undoing your edits clears the "modified" dot.** If you change a note
  and then type or undo it back to how it was saved, the tab no longer
  shows unsaved changes, and closing it doesn't ask you to save.
- **Saving an unchanged note no longer rewrites it.** Ctrl+S with no
  changes now leaves the file alone, so OneDrive doesn't re-sync it and
  Notepad++'s folder panel doesn't list it twice.

## [0.7.2] - 2026-10-14

### Added
- **See what's new before you update.** The update dialog now lists the
  new version's changes, so you don't have to open the release page first.

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
