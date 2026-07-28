// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Keystatic (+ React) run in dev so a single `npm run dev` serves both the
// site and the /keystatic editor. Never included in the production build, so
// the deployed site stays fully static. MDX is always on so pages render.
const isDev = process.env.NODE_ENV !== 'production';

// https://astro.build/config
export default defineConfig({
  // No `site` hardcoded — custom domain comes later; nothing should assume it.
  // Prefetch linked pages (nav sits in-viewport everywhere) so navigation
  // is near-instant. Paired with <ClientRouter/> for in-place page swaps.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [mdx(), ...(isDev ? [react(), keystatic()] : [])],
  vite: {
    // Pre-bundle Keystatic's heavy deps at startup so Vite doesn't discover
    // them mid-session and trigger a disruptive full dev-server reload (the
    // main cause of the sluggish feel). Cached after the first run.
    optimizeDeps: {
      include: isDev
        ? ['@keystatic/core', '@keystatic/astro', 'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']
        : [],
    },
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
