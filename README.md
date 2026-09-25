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

Produces platform installers under `src-tauri/target/release/bundle/`, for
the platform you are currently on — Tauri does not cross-compile, so a Linux
machine produces `.deb`/`.rpm`/`.AppImage` and never the Windows `.exe`.
Unsigned builds work fine for local use; distributing to others will trigger
OS warnings (Windows SmartScreen, macOS Gatekeeper) without code signing /
notarization.

## Releasing

The shipped Windows installers are built by CI, not locally. To cut a
release:

```sh
pnpm run release 0.2.0      # add --dry-run to see the checks without writing
```

That bumps the version in the three places it lives (`package.json`,
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`), refreshes
`Cargo.lock`, commits, and creates the `v0.2.0` tag. It stops there. Pushing
the tag is the step that actually publishes, so it is left to you:

```sh
git push origin main --follow-tags
```

Pushing a `v*.*.*` tag runs `.github/workflows/release.yml`, which builds on
Windows and leaves a **draft** GitHub release — invisible to everyone,
including the marketing site's Download section, until you publish it by
hand. Afterwards, add an entry to [`docs/RELEASES.md`](./docs/RELEASES.md).

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
