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

- **[site] Host the marketing site on Cloudflare Pages.** Not yet set up —
  needs a Cloudflare account/project connected to the repo, an
  `@astrojs/cloudflare` adapter only if the site later needs SSR (static
  output deploys to Pages without one), and a build config pointing at
  `site/` (`pnpm --dir site build`, output `site/dist`). Cloudflare Pages
  / Vercel / Netlify were all noted as options in `site/PRODUCT.md`;
  Cloudflare Pages is now the intended target. Blocks the domain and
  sitemap items below.
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
- **[app] Evaluate a non-webview UI over `notes-core`.** The standing
  complaint is that an HTML front end feels gimmicky even though it ships as
  a desktop window. `src-tauri/core/` was split out (2026-09-25) precisely so
  this stays cheap to try, and it is now the *only* prerequisite that is
  done. The cost centre is CodeMirror 6, not the HTML: `basicSetup` alone
  provides undo history, multi-cursor, bracket matching, a search panel and
  autocompletion, on top of which sit markdown highlighting with embedded
  code languages (`@codemirror/language-data`), the fenced-code decoration
  plugin (`src/codeBlockBackground.ts`) and three themes expressed as
  CodeMirror highlight styles. Replacing the shell — tabs, sidebar, command
  palette, status bar — is the easy part.
  - Iced is the realistic target: its `text_editor` widget (cosmic-text) plus
    `iced_highlighter` (syntect) is the only credible cross-platform Rust
    option with highlighting out of the box. Known losses: multi-cursor, code
    folding, the search panel, per-block code backgrounds.
  - Worth knowing before spending anything: none of the cross-platform Rust
    toolkits (Iced, Slint, egui, GPUI) draw OS-native widgets — they all
    custom-render, as Sublime Text and Zed do. "Native" here means "not a
    webview", not "OS controls". Literal OS widgets would mean SwiftUI +
    WinUI + GTK over the core crate, i.e. three front ends, which conflicts
    with the cross-platform principle in `PRODUCT.md` for a solo project.
  - GTK4 + `sourceview5` is the dark horse: `GtkSourceView` is a genuine
    native code-editor widget, but it only looks native on Linux.
  - Suggested first step if this is ever picked up: prototype the editor pane
    alone (markdown highlighting, one theme) in Iced. Don't port the shell
    first — the shell always works, and the editor is what decides it.

## Done

_(none yet)_
