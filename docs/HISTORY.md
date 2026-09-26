# History

A running log of notable work across this repo — the Notes app (`src/`,
`src-tauri/`) and the marketing site (`site/`). Newest entries first.

This is a curated summary for humans and future Claude sessions — not a
replacement for `git log`, which remains the source of truth for exact
diffs. Add an entry here after any change worth remembering the "why" of:
a feature, a fix with a non-obvious cause, a decision that closes off an
alternative, a new release.

Each entry: date, one-line summary, then a couple of bullets on what
changed and why (if the "why" isn't obvious from the commit itself), and
which part of the repo it touched (`app` and/or `site`).

---

## 2026-09-26 — Whole-repo review: data-loss fixes and a real consent boundary [app]

A full code review turned up bugs that could lose writing, and a file-access
check that didn't protect anything. All were fixed together.

- **Lost edits.** A tab's saved editor state only caught up with the screen
  on a tab switch or a save. So clicking the tab you were already on
  reloaded that older state, wiping edits made since then. Ctrl+Shift+S
  saved that older state too, and marked the tab clean. And after Save As,
  new edits never marked the tab unsaved, because the edit callback still
  looked the tab up by its old key. Now every editor update writes back to
  `tab.state`, and callbacks reach the tab through the object, not the key.
- **Save As.** Saving over an existing file used to show "File changed on
  disk", because the tab still had the old file's modification time, and
  "Reload" then loaded the other file over your edits. Save As now writes
  first and re-keys the tab only if the write succeeds. When `.md` is added
  to a typed name that already exists, the app asks before replacing it.
- **Consent model.** `grant_path_access` was an IPC command, so the webview
  could grant itself `/`. Dialogs now run in Rust (`pick_folder`,
  `pick_note_file`, `pick_save_path`), and Rust grants dropped paths
  before emitting `notes://drop`. `load_state` re-grants remembered paths
  that still exist, and `save_state` drops any path this run never granted.
  A Save As target now grants that one file, not the folder it's saved into,
  and a deleted note no longer grants its old folder. The JS dialog plugin
  and its capabilities are gone.
- **Smaller fixes:**
  - Saves now write through symlinks instead of replacing them.
  - A state file missing its list fields loads with defaults instead of
    being set aside. Set-aside `.bak` files are timestamped so a second
    bad file doesn't overwrite the first.
  - The folder walk works on a copy of the grant list, so it doesn't lock
    out saves.
  - The unsaved marker in the title bar, status bar and sidebar now shows
    on the first edit.
  - Word counts are updated after a short pause instead of on every
    keystroke.
  - Pasting code inside a code block no longer adds a second fence.
  - Code-block backgrounds update when background parsing finishes.
  - `release.sh` uses `perl` instead of GNU-only `sed`.

## 2026-09-26 — Prepare the repo for public view [app] [site]

The repo was already public on GitHub. This entry covers the audit and the
cleanup that followed it.

- Audited the full history of all branches for secrets, tokens, keys,
  personal paths and large blobs. Found none. The two
  `CLAUDE_CODE_OAUTH_TOKEN` uses are Actions secrets, not values.
- Added an MIT `LICENSE`, and set `license` in `package.json` and both
  crates. The site footer already said "free and open source", but with no
  license file that wasn't true in law.
- Rewrote history (`git filter-repo --mailmap`) to replace a work email on
  the 2026-09-16/17 commits with a personal one. A force-push wasn't
  enough, because GitHub's read-only `refs/pull/*` kept the old commits
  reachable. So the GitHub repo was deleted and recreated from the
  rewritten `main`, `iced-rewrite` and both tags. The v0.1.0 and v0.2.0
  releases were re-created with the same notes and byte-identical
  installers (SHA-256 checked). The old issues and PRs (#1–22) were dropped
  on purpose, so `#n` references in older commit messages no longer
  resolve. Their fixes are in the code and in this file. Renovate was
  removed in favour of Dependabot.
- Rewrote the README in plain voice (what it is, what it refuses, commands,
  how it works) and replaced `site/README.md`, which was still the Astro
  starter text. Gave the repo a description and topics, and turned on
  secret scanning and push protection.
- Dependabot now covers npm (app and `site/`), cargo (`src-tauri/`) and
  GitHub Actions, not just the devcontainer. It runs weekly on Mondays with
  minor and patch bumps grouped per ecosystem. Security updates are on in
  the repo settings and don't wait for the schedule.
- Stopped tracking `.claude/settings.local.json`. It's per-machine by
  Claude Code's own convention.

## 2026-09-26 — Reject Iced as a replacement for the webview UI [app]

The port of the UI to Iced 0.14 (`iced-rewrite` branch, scaffolded on
2026-09-25) was stopped. The Tauri + CodeMirror front end stays. The
question behind it was "is an HTML UI the modern way to build a native
app?". The answer: Tauri is a mainstream choice, and Iced wouldn't be
more native. Iced, Slint, egui and GPUI all draw their own widgets
instead of using OS controls; only WinUI, WPF or WinForms would give
real Windows controls.

- The editor decided it, as `ENHANCEMENTS.md` predicted. Iced's
  `text_editor` has no undo/redo; the port had to add its own, keeping
  whole-document snapshots.
- It also has no gutter, decorations or scroll-offset API. So there is no
  way to add line numbers, fenced-code line backgrounds or a caret
  colour. Multi-cursor, folding, bracket matching and the search panel
  are missing too.
- What did work: syntect's Markdown grammar highlights fenced-code
  languages in a single parse, mapped onto the app's own theme colours.
  Its one flaw was blockquote lazy continuation, which needed a per-line
  fix. That covers the logic modules, themes and session model too, but
  none of it is worth the editor regression.
- `src-tauri/core/` (`notes-core`) stays split out. It costs nothing, and
  it keeps a future non-webview front end cheap if the Rust GUI
  toolkits' editors improve.

## 2026-09-26 — OpenCode in the devcontainer [app] [site]

- `opencode-ai` is installed globally in `.devcontainer/post-create.sh`
  (and added to npm's `allow-scripts`), next to Claude Code, as the
  alternative agent. That script is the `postCreateCommand`.
- `~/.local/share/opencode` (credentials in `auth.json`, sessions) and
  `~/.config/opencode` (user-level config) are symlinked by
  `.devcontainer/link-opencode.sh` to `/workspaces/.opencode/`, outside the
  repo but on the clone-in-volume `/workspaces` volume, so logins and
  sessions survive a rebuild. Chosen over new named volumes in `mounts`
  because it could be set up in the running container with no rebuild, and
  it still avoids bind-mounting agent config from the Windows host. The
  trade-off: any other repo cloned into the same volume (`notes-iced`)
  shares these OpenCode credentials.
- With "Reopen in Container" on a local folder, `/workspaces` is a
  root-owned mount point, and the script's `mkdir` used to fail the whole
  `postCreateCommand`. It now creates the store with `sudo` and `chown`s it
  to the container user. If `sudo` isn't available, it warns and skips
  instead, so OpenCode state then stays in `$HOME`.

## 2026-09-25 — Split the Rust core out of the Tauri shell, and stop the window behaving like a web page [app]

Both halves of one question: the app is a Tauri app whose UI is HTML, and
that reads as a web page rather than a native editor. Two separable
problems, fixed separately.

**`notes-core`.** `src-tauri/src/lib.rs` was 868 lines mixing the real work
(filesystem access, the consent model, atomic saves, the folder walk,
session persistence) with the Tauri IPC surface. The work is now a
standalone crate at `src-tauri/core/` with no Tauri dependency at all, and
`src/lib.rs` is 115 lines of command wrappers over it. The `*_impl`
functions were already written to take plain arguments and a granted set —
the suffix only existed to avoid colliding with the command names — so they
became the crate's public API unchanged, and all 20 unit tests moved with
them untouched.

- Two couplings had to go: `Error::ConfigDir(tauri::Error)` became
  `ConfigDir(String)`, and `state_path` now takes the config directory as
  an argument instead of resolving it from an `AppHandle`. The Tauri layer
  supplies it via `config_dir()`.
- `thiserror` and `serde_json` moved to the core crate and are no longer
  direct dependencies of the app crate.
- `src-tauri/Cargo.toml` became the workspace root (not the repo root), so
  `src-tauri/target/` and the `rust-cache` `workspaces: src-tauri` key in
  `release.yml` keep working as-is. CI's clippy and both `cargo test`
  invocations gained `--workspace`; `audit.yml` watches the new manifest.
- The point is optionality: a future non-webview UI can link this crate
  directly. Nothing about the current UI changed.

**Native chrome.** New `src/nativeChrome.ts`, installed from `main.ts`
before `DOMContentLoaded`. Suppresses the webview context menu (the
browser's "Reload / Inspect Element" menu was the loudest tell — the app
has no context menu of its own yet, see `ENHANCEMENTS.md`), blocks HTML5
`dragstart` outside `.cm-editor` so sidebar labels can't be dragged out as
markup, and in production builds only, swallows F5/Ctrl+R, F12,
Ctrl+Shift+I/J/C and Ctrl+U in the capture phase. Dev builds keep all of
it, so `tauri dev` is unaffected.

- `styles.css` now sets `user-select: none` on `body` and opts back in for
  `.cm-editor`, `input` and `textarea`, which is the native default rather
  than the web one; the two per-element `user-select` rules on the titlebar
  and sidebar became redundant and were dropped.
- Deliberately *not* changed: `zoomHotkeysEnabled` and
  `browserExtensionsEnabled` already default to `false` in Tauri 2, and the
  app implements its own Ctrl+±/Ctrl+wheel zoom, so those keys stay bound to
  the app. `devtools` was left unset in `tauri.conf.json` — release builds
  already ship without the inspector, since `Cargo.toml` never enabled the
  `devtools` feature, and setting it false would also kill it in dev.

## 2026-09-22 — Fix scroll-spy regression and other findings from a second design critique [site]

- Fixed a regression from the previous fix round: the header's scroll-spy
  nav indicator (`Header.astro`) never observed the hero (`#top`), so it
  stayed stuck lit on whatever section a visitor last scrolled past — most
  visibly, clicking the logo to jump back to the top left "Download" glowing
  in the nav indefinitely. Now `#top` is tracked alongside the nav-linked
  sections, and nothing is intersecting it clears all `aria-current` state.
- Promoted `Features.astro`'s three sub-group labels from `<p>` to `<h3>`
  (with an explicit `font-weight: 400` to keep the documented Label-tier
  weight, since the global `h1,h2,h3` rule defaults to 600) — previously
  invisible to heading-based screen-reader navigation.
- Replaced the hero mock's tab-clipping/ellipsis fix (from the previous
  round, which still clipped at 320px) with a horizontally scrollable tab
  row (`overflow-x: auto`, hidden scrollbar) — tabs keep their full real
  names at any width instead of truncating.
- Added `.section--tight-bottom` (`global.css`) and applied it to
  Positioning, Features, and Themes: tightens each section's bottom padding
  so pacing quickens slightly toward Download, the page's one conversion
  point, which keeps its full arrival padding.
- Why: found by a second `/impeccable critique` pass after the first fix
  round shipped — see `site/.impeccable/critique/` for the full report.
  Score held flat at 26/32 for the third run running, each round trading
  fixed issues for newly-surfaced ones (this time including a self-inflicted
  regression from the prior round's own fix).

## 2026-09-22 — Fix marketing site reliability and mobile issues from design critique [site]

- Split `getLatestRelease()`'s return into a `ReleaseState` union
  (`found` / `empty` / `error`) instead of a bare `ReleaseInfo | null`, so a
  GitHub API fetch failure no longer renders identically to a genuine "no
  release published yet" — it previously claimed pre-1.0 even when the
  release fetch had merely failed (e.g. rate limiting).
- Fixed a real horizontal-overflow bug at 320px viewport width: the header
  nav didn't wrap and the hero mock's tab labels didn't shrink, together
  pushing the page ~15px wider than the viewport on the narrowest common
  phone width. Also gave the hero mock's status bar `flex-wrap` so its two
  labels don't crush together at that width.
- Added a scroll-spy active state to the header's in-page anchor nav
  (`aria-current`, IntersectionObserver) — previously nothing indicated
  which section was in view while scrolling.
- Snapped four off-scale `border-radius` values (4px/2px) onto DESIGN.md's
  documented 5px/8px/10px scale.
- Why: found by `/impeccable critique` on `src/pages/index.astro`
  (26/32, Good) — see `site/.impeccable/critique/` for the full report.

## 2026-09-22 — Install Cloudflare Wrangler CLI in the devcontainer [app]

- Added `npm install -g wrangler` to `.devcontainer/devcontainer.json`'s
  `postCreateCommand` so it's reinstalled on every container rebuild
  (npm's global `node_modules` lives outside the persisted cargo volume
  mount, so a plain ad-hoc `npm install -g` would be wiped on rebuild).
- Also set `npm config set allow-scripts='esbuild,workerd' --location=user`
  first: npm 11's install-script allowlist otherwise silently skips the
  postinstall scripts that fetch the `esbuild`/`workerd` native binaries
  wrangler's own `node_modules` depends on, leaving `wrangler dev` broken
  even though `wrangler --version` still reports success.

## 2026-09-22 — Adopt Astro's Fonts API and enable Content Security Policy [site]

- Replaced the manual `@fontsource/ibm-plex-sans` and `@fontsource/jetbrains-mono`
  imports in `site/src/layouts/Layout.astro` with Astro's built-in Fonts API
  (`fonts` in `site/astro.config.mjs`, `<Font />` in the layout). Astro now
  self-hosts, subsets, and preloads both fonts and generates optimized
  fallback-font metrics; the `@fontsource/*` packages were dropped from
  `site/package.json`.
- Enabled Content Security Policy (`security.csp: true` in
  `site/astro.config.mjs`), stable since Astro 6. Astro auto-hashes the
  page's scoped `<style>` blocks; the site has no `<script>` tags, so no
  further script-src config was needed.
- CSP's style-src does not cover inline `style="..."` attributes by
  default. The site had several (theme-card colors in `Themes.astro`,
  mock-line and spectrum-marker widths in `Hero.astro`/`Positioning.astro`),
  all built from static, build-time-known values. Rewrote them as scoped
  CSS (`:nth-child` selectors, one class per theme id) instead of adding
  `'unsafe-hashes'` to the policy, keeping the CSP tight.
- Verified with `astro build` + `astro preview` in a browser: zero console
  errors, CSP header present, fonts render via the generated `<style>`
  `@font-face` blocks.
- Confirmed the site's `astro` dependency (`^7.3.4`) already satisfies
  Astro 6's breaking changes (Node 22+, Vite 7) and is in fact already on
  Astro 7 (see the "Future enhancements" note in `ENHANCEMENTS.md` — Astro
  7's Rust compiler, Queued Rendering, and Route Caching are stable by
  default in this version; nothing to configure there).

## 2026-09-22 — Add root docs: history, enhancements, releases [app, site]

- Added `docs/` at the repo root with `HISTORY.md` (this file),
  `ENHANCEMENTS.md`, and `RELEASES.md`, covering both the Notes app and
  the marketing site, and added a root `CLAUDE.md` pointing at them.
- Why: cross-session context (decisions, deferred ideas, release state)
  was living only in commit messages and scattered "Undecided" notes in
  `PRODUCT.md`, with nowhere for it to accumulate.

## 2026-09-22 — Add Astro marketing site with GitHub Releases download integration [site]

- Built the single-page marketing/download site under `site/` on Astro 7:
  header, hero, positioning, features, themes, download, footer.
- Styled from the app's own icon palette and theme definitions rather than
  generic template defaults.
- Download section fetches the latest GitHub release for
  `etiennedelange/notes` at request/build time (`site/src/lib/github.ts`),
  classifies assets by platform, and falls back to an honest "no release
  yet" empty state.
- Commit: `5645473`.

## 2026-09-22 — Add GitHub Actions workflow for automated release process [app]

- Added `.github/workflows/release.yml`: builds and publishes a draft
  GitHub Release with Tauri installers whenever a `v*.*.*` tag is pushed
  (or via manual dispatch).
- Commit: `0ae7704`.
