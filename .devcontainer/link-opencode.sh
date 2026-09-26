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
