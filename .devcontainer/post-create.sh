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
npm install -g wrangler

# opencode-ai's postinstall can pick the musl binary on glibc arm64 (Apple
# Silicon hosts), so fall back to installing the matching platform package.
case "$(uname -m)" in
	aarch64 | arm64) arch=arm64 ;;
	*) arch=x64 ;;
esac
if ldd --version 2>&1 | grep -qi musl; then libc=-musl; else libc=; fi
npm install -g opencode-ai || npm install -g "opencode-linux-${arch}${libc}" opencode-ai

# OpenCode's state lives in volumes (see "mounts" in devcontainer.json).
# Docker creates the volumes root-owned, along with any parent dirs of the
# mount points the image didn't already have.
OPENCODE_DIRS=("$HOME/.local/share/opencode" "$HOME/.config/opencode")
sudo chown "$(id -u):$(id -g)" "$HOME/.local" "$HOME/.local/share" "$HOME/.config" "${OPENCODE_DIRS[@]}"

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
