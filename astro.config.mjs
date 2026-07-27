// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Keystatic (and the React runtime it needs) only run in dev, where you edit
// content at http://localhost:4321/keystatic. The deployed site stays fully
// static — no serverless, no auth. MDX is always on so content pages render.
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
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
