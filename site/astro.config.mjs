// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

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
    // Bind all interfaces (not just localhost) so the dev container's port
    // forwarding can actually reach it.
    host: true,
  },

  // Astro's built-in Fonts API: replaces the manual @fontsource imports.
  // Astro downloads, self-hosts, and optimizes these (subsetting, fallback
  // metrics, preload links) instead of us managing font packages by hand.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      weights: [400, 500, 700],
    },
    {
      provider: fontProviders.google(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-sans',
      weights: [400, 500, 600, 700],
    },
  ],

  // Content Security Policy: stable in Astro 6. The site has no inline
  // scripts and no third-party styles/scripts, so the default 'self'
  // policy plus Astro's auto-hashed component styles covers it.
  security: {
    csp: true,
  },
});
