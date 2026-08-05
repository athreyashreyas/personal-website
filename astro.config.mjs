// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Which astro subcommand is running: 'dev' | 'build' | 'preview' | 'check' | …
// Taken from argv rather than NODE_ENV, which Astro does NOT set: `astro build`
// leaves it undefined, so a `NODE_ENV !== 'production'` test reads as "dev"
// during a production build and drags Keystatic + React (and the whole
// @keystar/ui pre-bundle) into it — a ~10-minute build for a dozen static
// pages, and a CMS shipped to the deployed site.
const cliCommand = process.argv.slice(2).find((arg) => !arg.startsWith('-')) ?? '';

// Keystatic (+ React) run in dev so a single `npm run dev` serves both the
// site and the /keystatic editor. Never included in the production build, so
// the deployed site stays fully static. MDX is always on so pages render.
const isDev = cliCommand === 'dev';

// Site-only dev: skip the heavy Keystatic + React integration (and its
// hundreds of pre-bundled @keystar/ui modules) for a fast `astro dev` startup.
// Use `npm run dev` when you're iterating on the site; `npm run dev:site-only`
// when you don't need the /keystatic editor at all.
const withKeystatic = isDev && process.env.SITE_ONLY !== '1';

// Every subpath a package exposes (e.g. '@keystar/ui/menu'), read from its own
// export map so the list stays complete as Keystatic updates. Resolved against
// this file rather than the working directory, so it can't silently come back
// empty when astro is invoked from elsewhere.
function subpathEntries(pkg) {
  try {
    const manifest = new URL(`node_modules/${pkg}/package.json`, import.meta.url);
    const { exports = {} } = JSON.parse(
      readFileSync(fileURLToPath(manifest), 'utf8'),
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
