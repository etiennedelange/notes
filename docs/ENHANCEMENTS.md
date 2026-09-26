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
  only appears on the site after a rebuild/redeploy. Live Content
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
- **[app] A real context menu for the editor.** `src/nativeChrome.ts` now
  suppresses the webview's own context menu outright, because it offered
  "Reload" and "Inspect Element" and nothing useful. That leaves right-click
  doing nothing at all, which is fine but not native — Notepad++ and every
  other editor give you Cut/Copy/Paste, and the sidebar wants
  Rename/Delete/Reveal. Needs an in-app themed menu (the same reasoning as
  the in-app unsaved-changes dialog: stay visually consistent rather than
  using the OS menu). Removing the suppression is not the answer.

## Done

- **[site] Host the marketing site on Cloudflare Pages.** Live at
  `notes-site-ojq.pages.dev`, deployed as static output with
  `pnpm deploy` in `site/` (Wrangler, project `notes-site`). No adapter
  needed. Custom domain and sitemap (under Open) are still to do.
- **[app] Evaluate a non-webview UI over `notes-core`.** Evaluated and
  rejected (2026-09-26). Iced's editor widget couldn't match CodeMirror, so
  the Tauri + CodeMirror front end stays. See the `HISTORY.md` entry of the
  same date.
