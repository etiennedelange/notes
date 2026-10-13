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

- **[app] Delete the unreleased `v0.3.0` tag.** It has no GitHub release
  (see `RELEASES.md`). Harmless, but `pnpm release` and GitHub's
  generated notes treat it as a real previous version.
- **[app] "Check for updates" on demand.** The updater only checks at
  startup (`src/update.ts`). Notes has no settings view to put a button in;
  a command-palette command would fit once the palette runs commands as
  well as files. Deferred 2026-10-12.
- **[app] Code-signed installer.** The NSIS installer is unsigned, so
  SmartScreen warns once on first install. Gitr's research (Azure Artifact
  Signing ~$10/month, SignPath Foundation free for open source, OV
  certificate $100–400/year) applies here too; a new certificate doesn't
  stop SmartScreen until it builds reputation. Deferred 2026-10-12.
- **[app] Cut CodeQL scope on PRs.** CodeQL default setup (repo settings,
  no workflow file) analyses actions, JS/TS and Rust on every PR push, about
  5 minutes a run. Options: drop languages that add little (actions), or
  switch to advanced setup with path filters. Deferred on 2026-09-26 when
  the other workflows were trimmed.
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
  close that gap without polling.
- **[app] A right-click menu for the sidebar.** The editor has one now
  (Cut/Copy/Paste/Select All, `src/editorMenu.ts`, 2026-10-13); the sidebar
  still does nothing on right-click, and wants Rename/Delete/Reveal in File
  Explorer. Reuse the editor's in-app popover menu rather than the native
  menu the tab strip uses. Rename and Delete need new Rust commands that go
  through the consent checks in `src-tauri/core`.

## Done

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
