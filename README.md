# Notes

A fast, low-ceremony desktop editor for `.txt` and `.md` files — the middle ground between Notepad++ (fast, but dated) and Obsidian/VS Code (powerful, but heavyweight and workspace-oriented).

No vaults, no index database, no required project structure: point it at a file or a folder and start typing.

## Features

- Open/edit/save `.txt` and `.md` files directly from disk
- Optional folder sidebar (a view, not a managed workspace) with drag-and-drop
- Multiple tabs, with unsaved-changes and disk-conflict protection
- `Ctrl+P` fuzzy quick-open across the open folder, pinned files, and recent files
- Three built-in themes, switchable live: **Nord**, **Tokyo Night**, **Noctis Lux**
- Markdown syntax highlighting in the editor

See [`PRODUCT.md`](./PRODUCT.md) for the full product context and design decisions.

## Development

Requires [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/tools/install), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
npm install
npm run tauri dev
```

## Building

```sh
npm run tauri build
```

Produces platform installers under `src-tauri/target/release/bundle/`. Unsigned builds work fine for local use; distributing to others will trigger OS warnings (Windows SmartScreen, macOS Gatekeeper) without code signing / notarization.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
