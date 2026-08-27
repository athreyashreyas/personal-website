# Personal site

Astro + MDX content collections, edited through a local **Keystatic** CMS.
Fully static, no database, no backend. Deployed on Netlify. Built to the spec
in [`personal-site-spec.md`](./personal-site-spec.md).

Requires Node 20.3+, 22, or 24 (see `.node-version`; Node 21 is not supported
by Astro).

## Develop

```sh
npm install
npm run dev            # http://localhost:4321  (site + CMS at /keystatic)
npm run dev:site-only  # same, minus Keystatic — fastest cold start
npm run edit           # http://localhost:4322  the lightweight editor (below)
npm run build          # outputs to dist/  (static; CMS excluded)
npm run preview        # serve the production build locally
npm run check          # typecheck .astro/.ts (astro check) — run before pushing
```

## Two ways to edit content

Both write the same plain files into `src/content` and `public/images`, and
both are local-only:

- **`npm run dev` → /keystatic** — the full CMS: rich MDX editor, inline image
  drag/paste, the project "stills" as blocks.
- **`npm run edit`** — a dependency-free editor (plain `node:http`, no Vite, no
  React) that starts instantly. Frontmatter fields, a Markdown textarea with a
  small toolbar, and image upload. Good when you just want to fix a sentence.

## Adding content — the easy way (Keystatic CMS)

This is the normal way to write posts and projects. No Markdown, no
frontmatter by hand.

1. Run `npm run dev`.
2. Open **http://localhost:4321/keystatic**.
3. Pick **Writing** or **Projects**, hit **＋ Create**, fill in the fields, and
   write the body in the rich editor — headings, **bold**, bullet lists,
   quotes, and **images dragged/pasted inline** between paragraphs.
4. Click **Save**. Keystatic writes an `.mdx` file into `src/content/…` and
   drops any images into `public/images/…`.
5. Publish it — see the versioning commands below.

**How it stays static & private:** Keystatic (and its React runtime) load only
under `astro dev` — see the `cliCommand` switch in `astro.config.mjs`. It keys
off the astro subcommand rather than `NODE_ENV`, which Astro never sets, so a
production build genuinely excludes the CMS instead of only appearing to. The
deployed site ships no CMS, needs no login, and has no serverless functions.
You author locally and publish via git. (To later edit from anywhere incl.
phone, flip `storage.kind` in `keystatic.config.tsx` from `'local'` to
`'github'` and install the Keystatic GitHub app — no other change needed.)

## Publishing & restoring content (your safety net)

Because content is just files in git, every publish is a restore point. These
commands wrap git so you never have to remember it — and none of them delete
anything without first showing you exactly what will change and asking:

```sh
npm run content:status     # what you've changed since the last publish
npm run content:publish    # save a restore point (commit) + push it live
npm run content:undo       # throw away unpublished edits — a bad/wrong save
npm run content:history    # list recent publishes you can go back to
npm run content:restore -- 1   # bring back an earlier version (by number or hash)
```

Typical rescues:

- **"I saved a mess in the editor and want the last good version back."**
  → `npm run content:undo` (restores the last published version; only affects
  edits you haven't published yet).
- **"I published something wrong and want to roll back."**
  → `npm run content:history` to find the good version, then
  `npm run content:restore -- <number>`, review with `npm run dev`, and
  `npm run content:publish` to make it live again.

> First time only: run `npm run content:publish` once to create your first
> restore point. Until a version has been published, there's nothing for
> `undo`/`restore` to fall back to (they'll tell you this rather than delete
> anything).

Prefer a custom label on a restore point? `npm run content:publish -- "fixed the Harmony write-up"`.

## Adding content — by hand (optional)

The CMS just reads/writes plain files, so you can still author directly. Add an
`.mdx` file to `src/content/writing/` or `src/content/projects/` — the filename
becomes the URL slug (`my-post.mdx` → `/writing/my-post`).

Writing frontmatter:

```yaml
---
title: Your title, which can carry a point of view
date: 2025-07-24
tags: ["optional", "tags"]
dek: One-line summary shown in the list view (optional).
draft: false   # true = hidden from the list and from production builds
---

Body in Markdown/MDX.
```

Project frontmatter:

```yaml
---
title: Project name
description: One-line summary.
status: active        # optional — e.g. active, archived, in progress
date: 2025-07-24      # optional — used for ordering
links:
  repo: https://github.com/...   # optional
  live: https://...              # optional
  doc: https://...               # optional — a write-up hosted elsewhere
---

The actual write-up — what it is, why you built it, what you got wrong,
where it stands.
```

### A new Lab experiment — a little code

Each experiment is its own self-contained page. Create
`src/pages/lab/<name>.astro` and wrap it in `BaseLayout` so it inherits the
nav and footer — beyond that it's free to use its own JS, canvas, etc.

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
---

<BaseLayout title="Experiment name" prose={false}>
  <!-- your interactive thing here -->
</BaseLayout>
```

Then add a link to it from `src/pages/lab/index.astro`.

## Design tokens

All colors, fonts, and spacing live as CSS custom properties in
`src/styles/global.css`. Light/dark defaults to `prefers-color-scheme` and can
be overridden by the header toggle (persisted per browser). Change the visual
identity in the tokens, not in individual components.

## Deploy

Push to `main`; the host builds with `npm run build` and publishes `dist/`.
Those settings live in the host's site config, not in the repo — there is no
`netlify.toml` or `wrangler.toml` here. Set the build image's Node version to
match `.node-version` (22).

NB: this section still describes Netlify below, but the site currently serves
from `shreyas-athreya.pages.dev` — Cloudflare Pages. Worth reconciling.

`src/pages/404.astro` builds to `dist/404.html`, which Netlify serves for any
unmatched path with no configuration needed. `public/robots.txt` allows
everything except `/lab/previews`, the unlinked scratch page.

### The canonical domain

`site` in `astro.config.mjs` is the one place a host is named. The sitemap,
`<link rel="canonical">`, `og:url` and every `og:image` URL are derived from
it, so moving to a custom domain is that line plus the `Sitemap:` line in
`public/robots.txt`.

## Discovery — tags, search, social cards

Four things that make the content findable. None of them need any authoring
beyond tagging an entry.

- **Tags.** One controlled vocabulary in `src/content/tags/`, now shared by
  writing, projects *and* recommendations rather than recommendations alone.
  `/tags` lists what is in use; `/tags/<id>` shows everything carrying it,
  grouped by kind. This is the only thing on the site that puts a book next to
  the project it turned into, so it is worth tagging entries generously.
- **Related entries.** The strip at the foot of a post or project, ranked by
  shared tags (`src/lib/related.ts`). It deliberately prefers a match from a
  *different* collection. An entry with no tags gets no strip.
- **Social cards.** `src/lib/og.ts` renders a 1200×630 PNG per page at build
  time with satori, rasterized through the `sharp` Astro already ships. The
  card list in `src/lib/og-routes.ts` is the single source of truth: it drives
  both the `/og/…png` endpoint and the `og:image` each page points at, so a
  page can never advertise a card that was not generated.
- **Search.** `⌘K`, `/`, or the magnifier in the nav. `/search.json` is built
  at compile time and fetched once, on first open; matching happens in the
  browser (`src/components/SearchPalette.astro`). Nothing hosted, nothing to
  keep in sync.

**Everything on this site links back into this site.** A recommendation has no
page of its own, so search results, tag pages, related strips and the Lab shelf
graph all point at `/recommendations#<slug>` — the entry's own note — rather
than at the book's source. Finding something here should land you on what was
written about it; the outbound link is on the title once you arrive. Lab items
follow the same rule via `/lab#<slug>`. If you add another surface that lists
recommendations, take the `href` from `src/lib/tags.ts` rather than from
`entry.data.url`.

Drafts stay out of all of it: tag pages and the search index both apply the
same `draft !== true` rule in production that the Writing list does.
