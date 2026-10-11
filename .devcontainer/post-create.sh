#!/usr/bin/env bash
#
# Dev container postCreateCommand. webkit2gtk/gtk3/etc. are Tauri build-time
# deps (pkg-config, linked by the tao/wry/webkit2gtk crates) — needed for
# `cargo build`/`cargo check` even though this container never runs or
# displays the GUI itself.
#
set -euo pipefail

cd "$(dirname "$0")/.."

sudo apt-get update
sudo apt-get install -y \
	libwebkit2gtk-4.1-dev \
	libgtk-3-dev \
	librsvg2-dev \
	libayatana-appindicator3-dev \
	libssl-dev \
	libxdo-dev \
	patchelf \
	pkg-config

corepack enable
pnpm install
npm config set allow-scripts='esbuild,workerd,opencode-ai' --location=user

# OpenCode's state lives in volumes (see "mounts" in devcontainer.json).
# Docker creates the volumes root-owned, along with any parent dirs of the
# mount points the image didn't already have. This must happen before the
# opencode-ai install: its postinstall verifies the binary with
# `opencode --version`, which fails with EACCES creating its data dir, and
# the installer then falls through to the musl package and errors out
# (EBADPLATFORM on glibc).
OPENCODE_DIRS=("$HOME/.local/share/opencode" "$HOME/.config/opencode")
sudo chown "$(id -u):$(id -g)" "$HOME/.local" "$HOME/.local/share" "$HOME/.config" "${OPENCODE_DIRS[@]}"

npm install -g wrangler opencode-ai

# One-time migration from the old link-opencode.sh layout, which kept this
# state under /workspaces/.opencode. cp -n never overwrites, so re-running is
# harmless; delete /workspaces/.opencode once the volumes have it.
OLD_STORE=/workspaces/.opencode
if [ -d "$OLD_STORE" ]; then
	cp -an "$OLD_STORE/data/." "${OPENCODE_DIRS[0]}/" 2>/dev/null || true
	cp -an "$OLD_STORE/config/." "${OPENCODE_DIRS[1]}/" 2>/dev/null || true
fi

# Last, since cp -a above carries the old dirs' modes across: auth.json
# holds provider credentials.
chmod 700 "${OPENCODE_DIRS[@]}"
