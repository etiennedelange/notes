# Notes site

The marketing and download page for [Notes](../README.md), built with Astro
and served as static files from Cloudflare Pages.

## Development

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Build static output to `dist/` |
| `pnpm deploy` | Build, then upload `dist/` to the `notes-site` Pages project with Wrangler |

## How it works

It's one page, `src/pages/index.astro`, assembled from the sections in
`src/components/`. The Download section gets the latest published GitHub
release at build time (`src/lib/github.ts`) and sorts its assets by
platform. A new release only shows up after a rebuild. Draft releases never
show up.

The site has its own look, separate from the app's themes. The tokens and
the reasons behind them are in [`DESIGN.md`](./DESIGN.md), and who the page
is for is in [`PRODUCT.md`](./PRODUCT.md).
