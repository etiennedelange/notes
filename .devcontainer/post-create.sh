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
npm install -g wrangler opencode-ai
bash .devcontainer/link-opencode.sh
