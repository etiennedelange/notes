#!/usr/bin/env bash
#
# Cuts a release: bumps the version everywhere it is duplicated, refreshes
# Cargo.lock, commits, and tags. It deliberately stops short of pushing —
# pushing the tag is what triggers the Windows build and drafts the GitHub
# release, and that is the step you want to be deliberate about.
#
#   pnpm run release 0.2.0
#   pnpm run release --dry-run 0.2.0
#
set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=0
VERSION=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) VERSION="$arg" ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }

[[ -n "$VERSION" ]] || die "usage: pnpm run release [--dry-run] <version>   e.g. 0.2.0"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || die "version must be X.Y.Z with no leading 'v' (got '$VERSION')"

# --- the three files that each carry the version independently -------------
# tauri.conf.json is the one that names the built assets
# (Notes_<version>_x64-setup.exe), so it is the source of truth here.
CURRENT=$(grep -m1 '"version"' src-tauri/tauri.conf.json | sed 's/.*"version": "\(.*\)".*/\1/')
[[ -n "$CURRENT" ]] || die "couldn't read the current version from src-tauri/tauri.conf.json"

PKG=$(grep -m1 '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')
CARGO=$(grep -m1 '^version = ' src-tauri/Cargo.toml | sed 's/version = "\(.*\)"/\1/')
if [[ "$PKG" != "$CURRENT" || "$CARGO" != "$CURRENT" ]]; then
  die "versions disagree before bumping — tauri.conf.json=$CURRENT package.json=$PKG Cargo.toml=$CARGO
       fix them by hand first, so this script isn't papering over a drift"
fi

[[ "$VERSION" != "$CURRENT" ]] || die "already at $VERSION"

# --- preflight -------------------------------------------------------------
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" == "main" ]] || die "on branch '$BRANCH' — releases are cut from main"

[[ -z "$(git status --porcelain)" ]] \
  || die "working tree is dirty — commit or stash first, so the tag points at a known state"

git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null \
  && die "tag v$VERSION already exists locally"
if git ls-remote --exit-code --tags origin "v$VERSION" >/dev/null 2>&1; then
  die "tag v$VERSION already exists on origin"
fi

if [[ -n "$(git log --oneline "origin/$BRANCH..HEAD" 2>/dev/null || true)" ]]; then
  echo "note: local main has commits not yet on origin; they will be part of this release."
fi

echo "Releasing $CURRENT -> $VERSION"
if (( DRY_RUN )); then
  echo "(dry run — nothing will be written)"
fi

# --- bump ------------------------------------------------------------------
if (( ! DRY_RUN )); then
  sed -i "0,/\"version\": \"$CURRENT\"/s//\"version\": \"$VERSION\"/" package.json
  sed -i "0,/\"version\": \"$CURRENT\"/s//\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
  sed -i "0,/^version = \"$CURRENT\"$/s//version = \"$VERSION\"/" src-tauri/Cargo.toml

  # Cargo.lock records the workspace member's version, so it has to be
  # regenerated or the release build fails on a stale lockfile.
  echo "Refreshing Cargo.lock..."
  (cd src-tauri && cargo check --workspace --quiet)

  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
  echo
  git --no-pager diff --cached --stat
  echo

  git commit -q -m "chore(release): v$VERSION"
  git tag -a "v$VERSION" -m "Notes v$VERSION"
fi

cat <<EOF

Committed and tagged v$VERSION locally. Nothing has been pushed.

To publish:

  git push origin main --follow-tags

That triggers .github/workflows/release.yml (Windows build) and leaves a
DRAFT release on GitHub — it stays invisible, including to the marketing
site, until you publish it by hand.

Afterwards:
  - add an entry to docs/RELEASES.md
  - check site/src/lib/github.ts still classifies the new asset names

To undo before pushing:

  git tag -d v$VERSION && git reset --hard HEAD~1
EOF
