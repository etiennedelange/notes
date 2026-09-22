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

- **[site] Pick and configure a deploy target.** No host is confirmed yet
  (Cloudflare Pages / Vercel / Netlify were noted as options in
  `site/PRODUCT.md`, none chosen). Blocks the domain and sitemap items
  below.
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

## Done

_(none yet)_
