#!/usr/bin/env bash
#
# Keeps OpenCode's state on the /workspaces volume (which survives container
# rebuilds) by symlinking its home dirs there. The data dir holds provider
# credentials (auth.json) and sessions; the config dir holds the user-level
# opencode.json. Safe to re-run: existing contents are moved across once,
# then the dir is replaced by the link.
#
set -euo pipefail

STORE=/workspaces/.opencode

# /workspaces is the vscode user's own volume with "Clone in Volume", but a
# root-owned mount point when a local folder is bind-mounted ("Reopen in
# Container"). Create the store with sudo there, and skip rather than fail
# the whole postCreateCommand if even that isn't possible.
if [ ! -d "$STORE" ] && [ ! -w "$(dirname "$STORE")" ]; then
  if sudo -n mkdir -p "$STORE" 2>/dev/null; then
    sudo -n chown "$(id -u):$(id -g)" "$STORE"
  else
    echo "link-opencode: $(dirname "$STORE") isn't writable and sudo is unavailable;" \
      "OpenCode state will stay in \$HOME and won't survive a rebuild." >&2
    exit 0
  fi
fi

link() {
  local home_dir=$1 store_dir=$2
  mkdir -p "$store_dir" "$(dirname "$home_dir")"
  if [ -d "$home_dir" ] && [ ! -L "$home_dir" ]; then
    cp -an "$home_dir"/. "$store_dir"/
    rm -rf "$home_dir"
  fi
  ln -sfn "$store_dir" "$home_dir"
}

link "$HOME/.local/share/opencode" "$STORE/data"
link "$HOME/.config/opencode" "$STORE/config"
chmod 700 "$STORE"
