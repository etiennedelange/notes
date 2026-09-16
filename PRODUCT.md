# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Tauri (Rust core + system webview). Front end is HTML/CSS/JS rendered in the webview, so it is designed and built like a web UI, but ships and runs as a native desktop window, not a browser tab. Cross-platform target: Windows, macOS, Linux.

## Users

A single primary user (the developer/owner) who currently bounces between Notepad++, Obsidian, and a bare VS Code workspace for quick text and markdown notes. They want one fast, low-ceremony tool for jotting and reading `.txt`/`.md` files, opened ad hoc rather than through a managed workspace.

## Product Purpose

A quick, snappy note/text editor that replaces Notepad++ for `.txt` and `.md` files, adding first-class markdown handling and fast fuzzy search, without adopting the overhead of a "vault" (Obsidian) or a full IDE workspace (VS Code). Success = opens instantly, feels lighter than VS Code, and lets the user find and jump into any file in a couple of keystrokes.

## Positioning

Sits deliberately between Notepad++ (fast but dated, no real markdown support) and Obsidian/VS Code (powerful but heavyweight, workspace/vault-oriented). The differentiator is refusing ownership of the user's files: no vault, no index database, no project config required to start typing — while still offering the modern conveniences (Ctrl+P quick-open, tabs, markdown rendering) those heavier tools popularized.

## Operating Context

- Desktop app, launched frequently for short sessions (open a file, jot something, close).
- Files live wherever the user already keeps them on disk; the app does not require or create a dedicated folder structure.
- A folder can optionally be opened in a sidebar tree for browsing, and files can be dragged in — but this is a convenience view, not a managed workspace.
- Primary content types: plain `.txt` and `.md`.

## Capabilities and Constraints

Confirmed for v1:
- Open/edit/save `.txt` and `.md` files directly from disk, no import step.
- Optional folder sidebar (file tree) that can be opened/closed at will; drag-and-drop files into it.
- Multiple tabs open at once.
- Ctrl+P quick-open / fuzzy file search.
- Deliberately minimal scope for v1 — no markdown live preview, no full-text/grep search, no vault/index, no plugin system. These are explicitly deferred, not rejected forever.

Delivered in v1 build so far:
- Sidebar: open-folder tree (loose, non-owning view) + pinned "loose files" section for individually opened files.
- Tabs with dirty-state indicator, close/cycle shortcuts.
- Ctrl+P fuzzy quick-open across tree + pinned + recent files.
- Three built-in themes, switchable live from the status bar: Nord, Tokyo Night, Noctis Lux (light).
- Status bar: file path, unsaved indicator, cursor position, language, theme switcher.
- Drag-and-drop of files/folders onto the window.
- Unsaved-changes protection on tab close and app quit, via a themed in-app Save / Don't Save / Cancel dialog (not the OS-native message box, to stay visually consistent with the app's own theme).
- Persisted app state across restarts: last folder, open tabs, active tab, theme, recent files.

## Brand Commitments

None yet — no name, logo, or identity decided. Product is currently titled "Notes" as a working name (`productName` in tauri.conf.json).

## Evidence on Hand

None. No existing codebase, assets, or content; this was a greenfield build (Tauri scaffold generated 2026-09-16).

## Product Principles

1. No ownership of the user's files — no vaults, no databases, no required project structure.
2. Fast beats featureful — every v1 feature must earn its place against launch speed and simplicity.
3. Modern conveniences (quick-open, tabs, markdown awareness) without IDE weight.
4. Cross-platform from the start, but a single-user personal tool, not a collaboration product.
5. Minimal by default; depth is opt-in later, not upfront complexity.

## Accessibility & Inclusion

No specific requirement established yet.
