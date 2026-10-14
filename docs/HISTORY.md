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

## 2026-10-14 — The update dialog shows the release notes [app]

- `latest.json` has always carried the version's CHANGELOG section as
  `notes`, and `check_update` passed it to the webview, but the dialog
  never showed it. It now renders it in a scrolling box. With the notes
  shown, the What's New button is now Release Page.
- `releaseNotesHtml` in `src/update.ts` renders only what the CHANGELOG
  uses (### headings, wrapped bullets, paragraphs, bold, code; a link
  keeps its text) and escapes the input first. This avoids pulling in a
  Markdown library, and the notes come off the network, so nothing in
  them reaches the dialog as markup.
- An update that skips versions shows only the newest version's notes,
  because that's all `latest.json` holds.
- `pnpm mock:web --update` offers a fake update to the next patch, with
  the `[Unreleased]` notes. `mock.js` already answered `check_update` from
  `cfg.update`, but nothing set it. Checked with it in Chromium: status
  bar button, dialog with notes, Later closes it.

## 2026-10-14 — `pnpm release` watches the PR's CI live [app]

- `ship.mjs` used to poll `gh pr checks` every 10 seconds and print a dot.
  It now finds the PR head commit's CI and Rust runs (the workflows
  behind the required `frontend` and `rust` checks) and runs
  `gh run watch` on each in turn, so you see jobs and steps as they go.
  After that it polls only for the auto-merge, with a ten-minute limit.
- `gh run watch` follows one run, so it watches only the required
  workflows. A failing Security audit or Claude Code Review no longer
  stops the script. It never blocked the merge, but the old poll failed
  on any red check.

## 2026-10-14 — A right-click menu for the sidebar [app]

- Notes get Rename, Delete and Reveal in File Explorer (Finder on macOS,
  Show in Folder on Linux); folders get Reveal only. The popover logic
  moved out of `src/editorMenu.ts` into `src/contextMenu.ts`, shared by
  both menus.
- Three new Rust commands, all behind the consent checks in
  `notes-core`: `rename_note`, `trash_note` and `reveal_path`. Rename
  takes a bare file name, not a path, so it can't move a note out of its
  folder, and it refuses to replace an existing file (`fs::rename` would,
  silently). The shell grants the new name, since a grant on just the old
  file wouldn't cover it. Reveal runs through Rust rather than the opener
  plugin's JS API so it gets the same check.
- Delete moves to the Recycle Bin / Trash (`trash` crate) instead of
  deleting outright: a slip on a right-click menu should be undoable
  outside Notes. The core tests cover only its refusals, so a test run
  doesn't fill anyone's trash.
- Folders can't be renamed or deleted yet; see `ENHANCEMENTS.md`.

## 2026-10-14 — `pnpm release` picks the next patch; fresh screenshots [app] [site]

- A bare `pnpm release` releases the newest `v*` tag with its patch bumped
  (`nextPatch` in `scripts/release/ship.mjs`), like Gitr's release script.
  Minor and major bumps still take an explicit version.
- Screenshots regenerated for the README and the site, the first time since
  2026-09-26. The mocks now take the status bar version from `Cargo.toml`
  instead of a fixed string, so a rerun shows the version being released.

## 2026-10-14 — Hourly update checks; the status bar version checks on click [app]

- 0.6.0 didn't show up in an open copy of Notes. The release and its
  `latest.json` were fine: the live manifest parses with the updater
  crate and reports 0.6.0 as newer than 0.5.0. The cause wasn't pinned
  down; candidates are a copy older than 0.5.0 (no updater) or a failed
  check, which 0.5.0 only logs to a console release builds don't have.
  Separately, the updater checked only once, 5 seconds after startup, so
  a copy left open never saw a later release. `src/update.ts` now
  re-checks every hour until it finds one.
- Notes has no menu, About or settings screen to hang **Check for
  updates** on, so the running version (`v0.6.0`) sits in the status bar
  and checks when clicked: a toast if it's up to date or the check
  failed, the usual update modal if not. Reading the version needs the
  `core:app:allow-version` permission.

## 2026-10-13 — Native `<dialog>` and popovers; an editor right-click menu [app]

- The unsaved-changes modal and the Ctrl+P palette are modal `<dialog>`s
  (`showModal()`). The browser now does the inert background, focus
  trap, Escape and focus restore that `src/modal.ts` hand-rolled; a
  backdrop press is detected by the press point falling outside the
  dialog's box (`src/dialog.ts`), since a click on `::backdrop` and one on
  the dialog's padding both target the dialog.
- Toasts live in a `popover="manual"` container, in the top layer. That
  layer stacks by open order, so `raiseToasts()` re-shows the container
  after the unsaved-changes modal opens, keeping an error readable above
  the backdrop. It still can't be clicked away until the modal closes:
  a modal dialog makes everything outside it inert, popovers included.
- New right-click menu in the editor (`src/editorMenu.ts`), an auto
  popover so Escape and a click elsewhere close it and focus returns to
  the editor. Two non-obvious bits:
  - macOS and Linux fire `contextmenu` on mouse-down. Opened then, the
    release lands just outside the menu's rounded corner and counts as a
    light-dismiss click, so the menu closed instantly. It now waits for
    `pointerup` when the right button is still held (Windows fires on
    release, so it opens straight away there).
  - Paste dispatches a synthetic `paste` event into CodeMirror rather than
    inserting the text, so a menu paste gets the same code-block fencing as
    Ctrl+V. It needs `clipboard-manager:allow-read-text`, a new capability.
- CSS for these parts uses nesting and `@starting-style` (no more rAF
  class toggle for toast entry), and `prefers-reduced-motion` turns off
  the dialog, toast and tree-chevron transitions. It's scoped to those, not
  a blanket `*` rule, which would turn CodeMirror's cursor blink into a
  flicker. The rest of `styles.css` isn't nested yet; convert sections as
  they're touched rather than in one churny pass.
- Checked end to end in Chromium against `pnpm mock:web` (Playwright); the
  mock gained an in-memory clipboard for it. Not run in WebView2 or
  WebKitGTK itself.

## 2026-10-13 — Toolchain housekeeping: ES2023, Rust 2024, Node 24 [app]

- `tsconfig.json` targets and types against ES2023 (was ES2020). Every
  webview Tauri ships on supports it, so `findLast`, `toSorted` and the
  like typecheck now. `useDefineForClassFields` went with it, since it's
  the default from ES2022.
- Both crates are on Rust edition 2024. `cargo fix --edition` needed no
  code changes; clippy's `collapsible_if` then asked for one `if let`
  in `notes-core` to become a let-chain.
- CI and release workflows use Node 24 (the active LTS) instead of 22.
- `@types/node` is a dev dependency, which drops the `@ts-expect-error`
  on `node:process` in `vite.config.ts`.
- The 25 type-aware lint warnings from the Vite+ migration are gone:
  fire-and-forget calls from event handlers are marked `void`, and
  `${e}` in toasts is `${String(e)}`. `no-floating-promises` and
  `restrict-template-expressions` are errors now, except that
  `no-floating-promises` is off for `scripts/**/*.test.mjs`, where
  `node:test`'s top-level `test()` returns a promise the runner tracks.

## 2026-10-12 — `pnpm mock:web`: the app in a plain browser [app]

Added `pnpm mock:web` (`scripts/mock-web.mjs`). It starts the normal Vite
dev server and injects `scripts/screenshots/mock.js` into `index.html`, so
the UI runs with hot reload in any browser, opened on a sample folder.

- **Why:** the app can't be launched from the dev container, so UI work
  had no way to see the change short of `pnpm screenshots`. Reusing the
  screenshot mock keeps one fake backend to maintain.
- The mock's `write_text_file` now stores saves in memory, so saving and
  reopening a file behaves. Dialog commands (`pick_*`) return null, i.e.
  cancelled. A new IPC command needs a handler in `mock.js` for both uses.
- Binds all interfaces (`host: true`), like the site's dev server. Plain
  `localhost` resolved to IPv6 `::1` only, and the dev container's port
  forwarding connects over IPv4, so the browser just sat loading.

## 2026-10-12 — Vite+ for the app's front-end toolchain [app]

- `vite-plus` 1.1.0 (from the pnpm catalog in `pnpm-workspace.yaml`)
  replaces `vite` and `vitest`: `vp dev`, `vp build`, `vp test run`, and
  `pnpm check` (`vp check`: oxfmt, oxlint with type-aware rules, and
  typecheck), which CI's `frontend` job now runs. Same setup as Gitr. The
  `vite@*` override hands vitest and anything else that asks for vite
  Vite+'s copy. It replaces the old `vite >=8.0.16` security floor, which
  that copy already meets.
- The formatter keeps the existing style (double quotes, semicolons,
  120 columns). The one-off reformat touched 19 files, mostly line wraps.
  Tests import from `vite-plus/test`.
- The site (`site/`) keeps its own Astro toolchain and pnpm workspace.

## 2026-10-12 — Releases the Gitr way, and an in-app updater [app] [site]

Brought over what the Gitr repo (`etiennedelange/gitr`) learned about
building and shipping its Windows installer. `docs/RELEASING.md` has the
full picture.

- **One command.** `pnpm release 0.5.0` (`scripts/release/ship.mjs`)
  replaces `scripts/release.sh`. It opens a version PR, auto-merges it once
  CI passes, tags the merge commit and follows the Release run. It can be
  safely re-run after any failure. The version now lives only in
  `src-tauri/Cargo.toml`; `tauri.conf.json` and `package.json` no longer
  carry copies that can drift.
- **Published, not drafted.** `release.yml` builds with
  `pnpm tauri build --bundles nsis` and publishes with `gh release create`.
  `tauri-action` is gone, and with it the `@v0` "Resource not accessible"
  trouble (2026-09-26 entry). That entry had suggested `gh release` as the
  fallback. The job refuses a tag that isn't on `main` or doesn't match the
  version. It also adds `SHA256SUMS.txt` and drops the `.msi`.
- **Notes from `CHANGELOG.md`.** The new changelog's version section comes
  first in the release notes, then GitHub's list of merged PRs. That fixes
  v0.4.0's empty notes for good, and the updater shows the same text.
- **In-app updater.** `tauri-plugin-updater` reads `latest.json` from the
  latest release. The installer it downloads must match a minisign
  signature, and the key lives in repo secrets. Unlike Gitr's
  wait-for-git-writes, Notes' risk is unsaved tabs. So the download comes
  first, then the same Save / Don't Save / Cancel prompt as quitting
  (`App.prepareToExit`), then the installer. Nothing typed during the
  download is lost. The UI is a status bar button rather than Gitr's
  banner, because Notes has no settings view and should stay quiet.
- **CI always reports.** The `frontend` and `rust` jobs now start on every
  PR and skip their steps when `release.mjs ci-scope` finds nothing to
  test. A required check from a workflow skipped by `paths:` stays
  pending. Release PRs (version-only) skip the 9-minute Rust run.
  `scripts/release/github-settings.sh` makes the two jobs required and
  allows auto-merge, which `pnpm release` needs.
- **Warm release cache.** Caches saved under a tag are invisible to the next
  tag, so `release-cache.yml` builds on `main` to keep the release job's
  Rust and NSIS caches warm. It also catches a broken installer build
  before a tag. It builds without updater signing
  (`tauri.no-updater.conf.json`, a file because PowerShell strips the
  quotes of inline JSON: a Gitr bug).
- **Site rebuild.** A release created with `GITHUB_TOKEN` doesn't fire
  `release: published`, so `release.yml` starts `site-rebuild.yml`
  itself.
- Not ported: Gitr's Microsoft Store channel (MSIX detection, "store"
  update channel) and its third-party-notices check. Code signing stays
  deferred (`ENHANCEMENTS.md`).

## 2026-10-11 — OpenCode, GitHub CLI and Wrangler move into dev-setup [app] [site]

- `dev-setup` 1.1.0 (in `etiennedelange/devcontainer-features`): Claude
  Code is always installed. `githubCli` (on by default), `opencode` and
  `wrangler` (off; Notes turns both on) are boolean options,
  which VS Code's feature picker shows as tickboxes. `gh` comes from
  GitHub's apt repo, because a `dependsOn` feature can't be switched off.
  OpenCode installs at image build with its native installer
  (`opencode.ai/install`) as the container user.
- pnpm over npm wherever possible: the feature installs pnpm at image build
  with pnpm's own installer, not corepack (Node 25+ no longer ships it, so
  the node feature's `lts` would lose it at the next LTS), sets
  `PNPM_HOME=/usr/local/share/pnpm` (with `bin/` first on `PATH`), and
  installs Wrangler with `pnpm add -g --allow-build=esbuild
  --allow-build=workerd`. Without those build scripts `wrangler dev`
  breaks. That's the same reason npm needed `allow-scripts` before (see
  the 2026-09 entry). In Notes, `tauri.conf.json`'s
  `beforeDevCommand`/`beforeBuildCommand` and `CLAUDE.md` now use pnpm too,
  and `post-create.sh` drops `corepack enable`.
- Each tool's login lives in a volume shared across devcontainers:
  `opencode-state` (`~/.local/share/opencode` and `~/.config/opencode`
  link into it, because OpenCode has no data-dir variable), `gh-config`
  (`GH_CONFIG_DIR`) and `wrangler-config` (`~/.config/.wrangler` links in,
  for the same reason).
- Logging in is left to the user: container create ends by printing
  `dev-setup logins`, the login command for each installed tool with the
  logged-in ones ticked. An auto-prompted interactive login was considered
  and dropped. Tool choice can't be interactive anyway, because installs
  happen at image build with no terminal.
- Why: the npm `opencode-ai` install broke twice (see the entry below), and
  per-container volumes meant logging in again in every repo.
- `.devcontainer/`: dropped the `github-cli` feature, the per-container
  `opencode-data-*`/`opencode-config-*` mounts, and the opencode/wrangler
  installs in `post-create.sh`. Removed the `dev-setup` pin from the lock
  file so the next build resolves 1.1.0.

## 2026-10-11 — Fix opencode install in devcontainer (real cause) [app] [site]

- `.devcontainer/post-create.sh` failed with `EBADPLATFORM` for
  `opencode-linux-arm64-musl` on glibc arm64. The 2026-10-02 fix
  (`222244a`) assumed opencode-ai's postinstall picked the wrong libc and
  added a fallback install, but the fallback failed the same way.
- Real cause: the postinstall checks the glibc binary by running
  `opencode --version`. That exits with EACCES because the opencode data/config
  volumes were still root-owned (the `chown` ran *after* the install).
  When that check fails, the installer moves on to the musl package, which
  npm refuses.
- Fix: chown the volumes before `npm install -g opencode-ai`, and drop the
  fallback.

## 2026-10-11 — Dev tooling via a personal devcontainer feature [app] [site]

- `.devcontainer/`: replaced `anthropics/devcontainer-features/claude-code`
  with `ghcr.io/etiennedelange/devcontainer-features/dev-setup:1`, from the
  new private repo `etiennedelange/devcontainer-features`. It holds my
  standard devcontainer tooling, currently Claude Code and git signing.
- Why: Anthropic's feature does `npm install -g` as root at image build, so
  `claude update` and auto-update failed with "Insufficient permissions"
  unless run with sudo. And `~/.claude`/`~/.claude.json` lived in the
  container, so login, settings, plugins and MCP setup were lost on every
  rebuild.
- Claude Code: native installer as the container user; a fixed-name
  `claude-code-config` volume at `/var/lib/claude-code` with
  `CLAUDE_CONFIG_DIR` pointing at it (so `.claude.json` lives there too),
  shared by every repo using the feature; marketplaces and plugins installed
  on container create (defaults: the current plugin set plus
  `pbakaus/impeccable`).
- Git: user name/email and SSH commit signing with the forwarded agent's
  `github-sign` key, plus `allowed_signers` and a `git sigs` alias, matching
  `etiennedelange/gitr`.
- The package is private: a host needs `docker login ghcr.io` (token with
  `read:packages`) before building this devcontainer.

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
