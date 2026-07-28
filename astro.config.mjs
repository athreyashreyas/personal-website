// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Keystatic (+ React) run in dev so a single `npm run dev` serves both the
// site and the /keystatic editor. Never included in the production build, so
// the deployed site stays fully static. MDX is always on so pages render.
const isDev = process.env.NODE_ENV !== 'production';

// Site-only dev: skip the heavy Keystatic + React integration (and its
// hundreds of pre-bundled @keystar/ui modules) for a fast `astro dev` startup.
// Use `npm run dev` when you're iterating on the site; `npm run dev:cms` when
// you actually need the /keystatic editor.
const withKeystatic = isDev && process.env.SITE_ONLY !== '1';

// Every subpath a package exposes (e.g. '@keystar/ui/menu'), read from its
// own export map so the list stays complete as Keystatic updates.
function subpathEntries(pkg) {
  try {
    const { exports = {} } = JSON.parse(
      readFileSync(`node_modules/${pkg}/package.json`, 'utf8'),
    );
    return Object.keys(exports)
      .filter(
        (k) =>
          k.startsWith('./') &&
          !k.includes('*') &&
          !k.endsWith('.json') &&
          !k.endsWith('.css') &&
          k !== './types' &&
          // skip the ~1400 individual icon modules — tiny and lazy; bundling
          // them all makes Vite's optimizer choke.
          !k.startsWith('./icon/'),
      )
      .map((k) => pkg + k.slice(1));
  } catch {
    return [];
  }
}

// Pre-bundle Keystatic's heavy UI library (@keystar/ui) and core up front, so
// the admin doesn't compile each section on first navigation — the cause of
// slow section-switching in /keystatic. Cached after the first cold start.
const keystaticDeps = withKeystatic
  ? [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      '@keystatic/core',
      '@keystatic/astro',
      ...subpathEntries('@keystar/ui'),
      ...subpathEntries('@keystatic/core'),
    ]
  : [];

// https://astro.build/config
export default defineConfig({
  // No `site` hardcoded — custom domain comes later; nothing should assume it.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [mdx(), ...(withKeystatic ? [react(), keystatic()] : [])],
  vite: {
    optimizeDeps: { include: keystaticDeps },
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
