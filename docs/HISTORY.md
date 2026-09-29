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

## 2026-09-29 — Refresh the folder tree on focus regain and manual click [app]

- `src/app.ts`: added `refreshFolder()`, which re-reads the open folder and
  skips the sidebar re-render if nothing changed. Wired to fire whenever
  the window regains focus (`onFocusChanged`), plus a new refresh button
  in the sidebar header (`icon-refresh`, already sitting unused in
  `index.html`).
- `src/fs.ts`: added `dirTreesEqual()` (tested in `fs.test.ts`) so a poll
  that finds no changes doesn't touch the DOM.
- Why: the tree was read once when a folder was opened and never again
  (issue #7) — a file created, deleted, or renamed outside Notes (another
  editor, Explorer, a sync client) didn't show up until the folder was
  closed and reopened. This is the "cheaper first step" from the issue;
  a Rust-side `notify` watcher that pushes updates live is deferred (see
  `ENHANCEMENTS.md`).

## 2026-09-28 — Error toasts stay up until dismissed [app]

- `src/toast.ts`: info toasts still auto-dismiss after 3.2s, but error
  toasts (failed saves, files that couldn't be opened, etc.) now stay on
  screen until clicked away. Extracted the duration choice into
  `toastDuration()` so it's unit-testable without a DOM.
- `src/styles.css`: `.toast-error` now has a filled red background and a
  small "!" badge instead of just red text/border, so it reads as more
  urgent than a routine "Saved note.md" toast.
- Why: errors were easy to miss — same 3s toast as routine messages,
  set apart only by red text (issue #6).

## 2026-09-26 — Rebuild the site when a release is published [app, site]

- Added `.github/workflows/site-rebuild.yml`: on `release: published` it
  POSTs to a Cloudflare Pages Deploy Hook (secret
  `CLOUDFLARE_PAGES_DEPLOY_HOOK`).
- Why: the Download section reads the latest release at build time, and
  Cloudflare only builds on push. v0.4.0 was published ~10 minutes after
  its commit was pushed, so the site kept showing v0.3.0. The hook is
  separate from `release.yml` because that workflow leaves a draft, which
  `releases/latest` skips — publishing by hand is the moment that matters.

## 2026-09-26 — Release workflow needed `tauri-action@v1` [app]

- The `v0.3.0` tag build compiled fine, then `tauri-apps/tauri-action@v0`
  failed to create the release with `Resource not accessible by
  integration`. This was the workflow's first real run: v0.1.0 and v0.2.0
  were uploaded by hand after the repo was recreated.
- Not the token or the repo: the job's token had `contents: write`, the
  actor was the owner (not Dependabot), and disabling the "Protect main"
  ruleset changed nothing. A probe workflow making the same
  `POST /releases` call with the same token got `201`. The exact reason
  `@v0` was refused was never found.
- `v0.4.0` was tagged from `main`, which has Dependabot's bump to
  `tauri-action@v1` (plus `checkout@v7`, `setup-node@v7`,
  `pnpm/action-setup@v6`), and published cleanly. v0.3.0 stays tagged but
  unreleased.
- If it comes back: replace the action's publish step with
  `gh release create --draft` + `gh release upload`, the call proven to
  work, and keep `tauri-action` (or `pnpm tauri build`) for the build.

## 2026-09-26 — Allow Cloudflare Web Analytics through the site CSP [site]

- Chose Cloudflare Web Analytics for visitor stats: free, cookieless (no
  consent banner), and native to the Pages host. Enabled in the dashboard,
  not in code — Pages injects the beacon script on deploy.
- `security.csp` in `site/astro.config.mjs` now adds
  `https://static.cloudflareinsights.com` to `script-src`. Without it the
  CSP silently blocks the injected beacon and the dashboard shows zero.
  No `connect-src` entry needed: the policy has no `connect-src` or
  `default-src`, so the beacon's POST isn't restricted.
- Web Analytics has no event tracking; download counts come from GitHub's
  per-asset `download_count` instead. Click tracking deferred (see
  `ENHANCEMENTS.md`).

## 2026-09-26 — Trim GitHub Actions runs [app] [site]

The Rust job moved out of `ci.yml` into its own `rust.yml`, which only
runs when `src-tauri/**` changes. `ci.yml` (the frontend job) now skips
site, Rust, docs, devcontainer and Markdown-only changes. The Claude review
workflow skips Dependabot PRs and drafts, and a new push cancels an
in-flight review. Dependabot's `github-actions` and `devcontainers`
updates went from weekly to monthly.

- **Why:** the Rust job takes about 9 minutes (4.5 of them are the
  release-profile tests) and was running on every push. That included
  site-only Dependabot bumps and docs commits. Claude review never worked
  on Dependabot PRs anyway: those runs read Dependabot's secret store, which
  has no `CLAUDE_CODE_OAUTH_TOKEN`. Neither workflow is a required check
  in the `Protect main` ruleset, so skipping them can't block a merge.
  If one becomes required, a skipped run stays "pending" and blocks the PR.

## 2026-09-26 — Real screenshots, generated headlessly [app] [site]

Added `pnpm screenshots` (`scripts/screenshots/`), which captures the
editor and Ctrl+P quick-open in all three themes. It writes framed and bare
PNGs to `docs/screenshots/` and copies the bare set to
`site/src/assets/screenshots/`. The README now shows them, and the site's
hero, Features and Themes sections use them in place of the drawn mock-ups.

- **Why headless:** the app can't be launched from the dev container, and
  launching it on Windows didn't work for this. The front end doesn't need
  Tauri to render, so the script runs it on Vite in headless Chromium, and
  `mock.js` fakes `window.__TAURI_INTERNALS__`: a sample notes folder,
  session state, and no-op window and event calls. The UI is real; only the
  files are made up. If a new IPC command is added and the shots break,
  that's the file to update.
- Fonts: Segoe UI and Cascadia Code aren't on Linux, so the shots load Inter
  and JetBrains Mono from Google Fonts. Both are already in the app's
  font stacks.
- The site needed `sharp` as a direct dependency for `astro:assets` to
  produce the AVIF/WebP versions. It was only there transitively before,
  which pnpm's strict layout doesn't expose.

## 2026-09-26 — Dismiss Dependabot glib alert [app]

Dismissed Dependabot alert #1 (GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429,
unsound `glib::VariantStrIter`) as tolerable risk.

- **Why:** `glib 0.18.5` comes in through Tauri's Linux gtk-rs 0.18 stack
  (`gtk`, `webkit2gtk`), and the fix is `glib ≥ 0.20`, so Dependabot's
  security update can't resolve and kept failing its run. `cargo audit`
  already ignores the same advisory in `src-tauri/.cargo/audit.toml`.
  Look at it again when Tauri moves to a newer gtk-rs.

## 2026-09-26 — Move OpenCode state to named volumes [app] [site]

`link-opencode.sh` is gone. OpenCode's data and config dirs are now
per-container named volumes in `devcontainer.json` `mounts`
(`opencode-data-${devcontainerId}`, `opencode-config-${devcontainerId}`).
That's the same pattern as the `node-ai` devcontainer template's
`claude-code-config-${devcontainerId}`, with ownership fixed in
`post-create.sh`.

- **Why:** the symlink approach was only chosen because it needed no
  rebuild. It also failed when `/workspaces` was root-owned ("Reopen in
  Container" on a local folder). And it shared OpenCode's credentials with
  every other repo cloned into the same `/workspaces` volume.
- **Ownership:** Docker creates new volumes root-owned, along with any
  missing parent dirs of the mount point. `post-create.sh` `chown`s them
  and sets the OpenCode dirs to `700`.
- **Migration:** on the first rebuild, `post-create.sh` copies the old
  `/workspaces/.opencode` state into the volumes (`cp -n`, never
  overwriting), so logins carry over. Delete `/workspaces/.opencode` once
  that's confirmed.

## 2026-09-26 — Public-readiness follow-ups [app] [site]

A second pass over the public repo, after the recreate below.

- Added `SECURITY.md` and turned on private vulnerability reporting. The
  app writes to disk, so reports shouldn't have to go through a public
  issue.
- Added a "Protect main" ruleset that blocks force-pushes to `main` and
  deleting it. There's no bypass. If history ever has to be rewritten again,
  switch the ruleset off first.
- `claude-code-review.yml` now skips PRs from forks. They don't get the
  `CLAUDE_CODE_OAUTH_TOKEN` secret, so outside contributors would have seen
  a failing check they didn't cause.

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
2026-09-25; the branch was deleted on 2026-09-26, and its tip was
`b587894`) was stopped. The Tauri + CodeMirror front end stays. The
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
- Superseded the same day by named volumes; see "Move OpenCode state
  to named volumes" above.

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
