# Future Enhancements

A backlog of ideas for this repo — the Notes app and the marketing site —
that are deliberately deferred, not forgotten. Add to this file instead of
letting an idea live only in a chat transcript or a PR comment. Move an
item to "Done" (with a link to the `HISTORY.md` entry or commit) when it
ships, rather than deleting it.

Format per item: one-line title, then why it matters and any constraints,
so a future session can pick it up without re-deriving context. Tag each
with `[app]`, `[site]`, or `[app, site]`.

## Open

- **[app] Adopt the brand's status colours.** `design/brand.md` gives
  Noctis Lux a crimson danger (`#d02a3a`, text `#c11830`) so an orange
  fits between it and warning; the app still has upstream's orange-red
  (`#c73c00`, text `#c23700` since the 2026-10-16 contrast fix).
  Hibernus derives its own from syntax colours. Change `danger`,
  `dangerText` and `warning` together; `themes.test.ts` checks contrast.
- **[app] Show when an open file was deleted outside Notes.** A clean
  tab whose file disappears stays as it was with no sign (VS Code marks
  it "deleted"); saving quietly recreates the file.
- **[app] Design system: FileTree preview still says "Pinned Files".**
  The section was renamed "Other Files" on 2026-10-14; the preview and
  its README weren't updated.

- **[app] Remaining UI review suggestions.** From the 2026-10-14 design
  review (see `HISTORY.md`), not yet done:
  - Show recent files, New File and Open Folder in the empty state.
    `recentFiles` is already persisted.
  - Show the sidebar headers in normal case. Uppercasing turns the
    folder's real name, `Notes`, into `NOTES`.
  - Show the fold arrows only when hovering the gutter.
  - Port the native tab context menu to the themed `installContextMenu`.
    It hardcodes "Reveal in File Explorer" on every OS.
  - Drop the "Saved x" toast on every Ctrl+S.
  - Screen-reader wiring for the palette (combobox and
    `aria-activedescendant`), tabs (roving tabindex) and the tree
    (`aria-expanded`). Unchecked: these came from an automated critique.
  - Adopt the rest of the brand's ground values: Noctis Lux's crimson
    danger and the warning/orange colours with their text variants
    (`design/brand.md`). Today's `#c73c00` is 4.25:1 as text on
    `bgHighlight`.
  - Propose the less-yellow Noctis Lux surfaces to the brand
    (`design/brand.md`), or note them as the app's deliberate departure.
  - Maybe make the 80-character text width a setting, if wide code blocks
    wrap annoyingly.

  Deferred 2026-10-14.
- **[app] Notes for every skipped version in the update dialog.** The
  dialog shows `latest.json`'s notes, which are only the newest version's
  CHANGELOG section, so someone on 0.5.0 updating to 0.7.1 doesn't see
  0.6.0's changes. Options: `updater-manifest` puts every section newer
  than some cutoff into `notes`, or the app fetches the CHANGELOG from
  the tag. Deferred 2026-10-14.
- **[app] Code-signed installer.** The NSIS installer is unsigned, so
  SmartScreen warns once on first install. Gitr's research (Azure Artifact
  Signing ~$10/month, SignPath Foundation free for open source, OV
  certificate $100–400/year) applies here too; a new certificate doesn't
  stop SmartScreen until it builds reputation. Deferred 2026-10-12.
- **[site] Track download/GitHub button clicks.** Cloudflare Web Analytics
  gives page views but no events. If GitHub's per-asset download counts
  aren't enough, options are a small Pages Function logging clicks to
  Workers Analytics Engine/D1 (first-party, needs `connect-src` in the
  CSP) or Plausible/Umami (third-party). Deferred 2026-09-26.
- **[site] Custom domain.** No domain is set (`site/astro.config.mjs` has
  no `site` configured). Depends on the deploy target decision.
- **[site] Sitemap / canonical URL setup.** Blocked on the domain
  decision — Astro's sitemap integration needs a final `site` URL to
  generate correct output.
- **[app] macOS and Linux release builds.** `release.yml` currently only
  builds Windows; v0.1.0 shipped Windows-only assets. The site's Download
  section already has per-platform classification logic
  (`site/src/lib/github.ts`) ready for macOS/Linux assets once they exist.
- **[app] Image paste support in the editor.** Noted as a deferred future
  enhancement (commit `e835e5d`); not yet scheduled.
- **[site] Switch the Download section to Astro Live Content Collections.**
  The latest-release fetch (`site/src/lib/github.ts`, called from
  `index.astro`) currently runs at build time, so a new GitHub release
  only appears on the site after a rebuild/redeploy (now triggered
  automatically on publish by `site-rebuild.yml`, which makes this less
  pressing). Live Content
  Collections fetch at request time instead, but require moving off
  static output onto an SSR adapter — blocked on the deploy-target
  decision above. Astro 7's Route Caching (stable, `Astro.cache` +
  `routeRules`) would pair well with this to avoid hitting the GitHub API
  on every request.
- **[site] Prism instead of Shiki, if code syntax highlighting is ever
  added.** `astro build` currently warns that Shiki's inline styles are
  incompatible with the site's CSP (`security.csp` in
  `site/astro.config.mjs`); the site doesn't render any code blocks today
  so this is inert, but would need addressing before adding any
  Markdown/MDX content with fenced code.
- **[app] Live-push folder tree updates via a Rust file watcher.** The
  sidebar now catches outside changes on focus regain and a manual
  refresh button (2026-09-29, issue #7), but still doesn't update while
  the app stays focused — e.g. a sync client writing files in the
  background. A `notify`-crate watcher on the open folder (in
  `src-tauri`) emitting an event the frontend applies incrementally would
  close that gap without polling. The same watcher could reload clean
  open tabs immediately; today they catch up on focus regain (2026-10-14).
- **[app] Rename and delete folders from the sidebar.** The sidebar menu
  (2026-10-14) renames and deletes notes only; a folder gets Reveal alone.
  A folder can hold files the tree hides (non-notes, dotfiles), so deleting
  one needs a confirm that says what else goes with it, and renaming one
  has to re-key every open tab, pinned tab and recent file under it.
- **[app] Switch a renamed tab's language mode.** Renaming `todo.txt` to
  `todo.md` keeps the open tab in plain-text mode until it's reopened, since
  the mode is fixed when the tab's editor state is created. Rebuilding the
  state on rename would drop its undo history.

## Done

- **[app] Rename "Pinned Files".** Done 2026-10-14: now "Other Files",
  filled only by the tab menu's "Add to Sidebar" (issue #8). See the
  2026-10-14 `HISTORY.md` entry.
- **[app] A right-click menu for the sidebar.** Done 2026-10-14: Rename,
  Delete (to the Recycle Bin / Trash) and Reveal for notes, Reveal for
  folders. See the 2026-10-14 `HISTORY.md` entry. Folders still can't be
  renamed or deleted (under Open).

- **[app] Delete the unreleased `v0.3.0` tag.** Decided against,
  2026-10-14. The "release tags" ruleset (repo settings, `refs/tags/v*`,
  no bypass) blocks deleting it, and switching the ruleset off leaves
  every release tag unprotected for no real gain. The tag has no GitHub
  release and does no harm.

- **[app] "Check for updates" on demand.** Done 2026-10-14 in 0.7.0:
  clicking the version in the status bar checks. See the 2026-10-14
  `HISTORY.md` entry on hourly update checks.
- **[app] Cut CodeQL scope on PRs.** Moot as of 2026-10-14: CodeQL default
  setup is turned off (the API reports `not-configured`; last run
  2026-09-26), so it no longer runs on PRs. If code scanning comes back,
  drop the `actions` language or use advanced setup with path filters.

- **[app] Native `<dialog>`, Popover API and modern CSS.** Done
  2026-10-13, with the editor's right-click menu. See the 2026-10-13
  `HISTORY.md` entry.
- **[app] A real context menu for the editor.** Done 2026-10-13 as an
  in-app popover; the sidebar's is still open above.
- **[app] Clear the `vp check` warnings.** Done 2026-10-13; the two
  rules are errors now. See the 2026-10-13 `HISTORY.md` entry.
- **[app] Release notes from the commit log.** Done 2026-10-12 another way:
  the notes are now the version's `CHANGELOG.md` section, followed by
  GitHub's list of merged PRs. See the 2026-10-12 `HISTORY.md` entry.
- **[site] Host the marketing site on Cloudflare Pages.** Live at
  `notes-site-ojq.pages.dev`, deployed as static output with
  `pnpm deploy` in `site/` (Wrangler, project `notes-site`). No adapter
  needed. Custom domain and sitemap (under Open) are still to do.
- **[app] Evaluate a non-webview UI over `notes-core`.** Evaluated and
  rejected (2026-09-26). Iced's editor widget couldn't match CodeMirror, so
  the Tauri + CodeMirror front end stays. See the `HISTORY.md` entry of the
  same date.
