# Repo Guide

This repo contains two things:

- **The Notes app** (`src/`, `src-tauri/`) — a Tauri desktop editor. See
  root [`PRODUCT.md`](./PRODUCT.md) for product context.
- **The marketing site** (`site/`) — an Astro site with its own
  [`CLAUDE.md`](./site/CLAUDE.md) (symlinked from `site/AGENTS.md`) for
  site-specific dev instructions (background dev server, Astro docs
  links). See [`site/PRODUCT.md`](./site/PRODUCT.md) for site context.

## Development (app)

```sh
npm install
npm run tauri dev
```

Build: `npm run tauri build`. See root [`README.md`](./README.md) for more.

## Docs

[`docs/`](./docs/) at the repo root tracks context that spans both the app
and the site, and doesn't belong in commit messages or `PRODUCT.md`:

- [`docs/HISTORY.md`](./docs/HISTORY.md) — dated log of notable work
  (features, fixes with a non-obvious cause, decisions). Add an entry
  after any change worth remembering the "why" of. Tag entries `[app]`,
  `[site]`, or both.
- [`docs/ENHANCEMENTS.md`](./docs/ENHANCEMENTS.md) — backlog of deferred
  ideas. When you defer something instead of doing it now, write it here
  rather than letting it live only in chat — move it to "Done" (linking
  the `HISTORY.md` entry) once it ships.
- [`docs/RELEASES.md`](./docs/RELEASES.md) — release history of the Notes
  app (the `v*.*.*` tag builds in `.github/workflows/release.yml`). Add
  an entry when a new version is tagged/published.

Keep these updated as you work rather than batching it at the end of a
session — it's cheap to add a line while the context is fresh, expensive
to reconstruct later.
