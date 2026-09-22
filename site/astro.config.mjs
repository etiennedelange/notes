// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // No custom domain yet — set this once the site has a permanent URL
  // (Cloudflare Pages / Vercel / Netlify default subdomain works fine without it,
  // but `site` is needed for correct canonical URLs and a sitemap later).
  // site: 'https://notes.example.com',

  // Pinned away from Astro's default 4321 so this doesn't collide with
  // another Astro/Vite project's dev server on the same machine or through
  // forwarded ports.
  server: {
    port: 4322,
  },
});
