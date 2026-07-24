# Personal Site — Build Spec

Handoff doc for Claude Code. This is a personal website — not a resume, not a
LinkedIn mirror. It should read like a specific person thinking out loud:
writing, projects, and a bit of a self-portrait. It also quietly does the job
of a portfolio when someone clicks through from LinkedIn, but that's a
side-effect, not the design goal.

---

## 1. Stack

- **Framework**: Astro
- **Hosting**: Netlify (default `*.netlify.app` subdomain for now, custom domain later)
- **Content**: Markdown/MDX via Astro Content Collections — no CMS, no database
- **Styling**: Plain CSS with custom properties (design tokens below). Tailwind
  optional for layout utilities only — do not use it to drive visual identity.
- **JS**: Minimal. Astro ships zero JS by default; only add interactivity
  (islands) where something is genuinely interactive (e.g. a `/lab` experiment).

## 2. Design tokens

### Typography
- Display / headings: **DM Serif Display**
- Body / UI / nav: **Plus Jakarta Sans**
- Both loaded via Google Fonts, self-hosted or `@font-face` preferred over a
  render-blocking Google Fonts link if performance matters.
- Body line length: constrain prose to ~65-75 characters (`max-width: 65ch` on
  article containers).
- Body line-height: 1.6–1.7.

### Color — light mode (default)
```css
--bg:            #FAF8F3;   /* warm paper, not stark white */
--text-primary:  #2B2420;   /* near-black, warm */
--text-secondary:#6B6558;   /* muted body/meta text */
--border:        #E4DFD1;   /* hairline dividers */
--accent-heading:#173D30;   /* deep emerald — decorative/heading use only */
--accent-link:   #1E6B4F;   /* brighter emerald, medium weight — links, CTAs */
```

### Color — dark mode
```css
--bg:            #211E1A;
--text-primary:  #F2EEE4;
--text-secondary:#A8A296;
--border:        #3A342C;
--accent-heading:#4C9A7C;
--accent-link:   #6FBFA1;
```
Respect `prefers-color-scheme`; no manual toggle needed for v1 unless trivial to add.

### Usage rules
- `--accent-heading` is for decorative/emphasis text that isn't interactive
  (e.g. a pull-quote, a section marker).
- `--accent-link` is for anything clickable — nav links, inline links, CTAs —
  and should carry `font-weight: 500` so it's distinguishable from body text
  at a glance, not just by color.
- No gradients, no drop shadows, no card-heavy UI. Borders are hairline
  (0.5–1px), corners are subtle (4–8px) or square — err toward square/minimal.
- No hero images, no decorative icons. If a project needs a visual, use an
  actual screenshot, not an illustration or icon.

## 3. Site structure

```
/                    -- home: short intro paragraph + links to Writing / Projects / About / Lab
/writing             -- reverse-chronological list of posts
/writing/[slug]       -- individual post
/projects            -- list of projects (Harmony, Attend, Hisaab, Ritu Sharma site, Simplismart benchmark, etc.)
/about               -- personal page — not a resume; life, interests, why
/lab                 -- placeholder page for now ("nothing here yet, check back")
                        structural home for future one-off interactive builds
```

### Home (`/`)
- One short paragraph, written in first person, in the person's actual voice
  (see Voice standard below). Not a tagline, not a job title.
- Below it: three or four plain-text links (Writing, Projects, About, Lab) —
  not buttons, not cards. Typographic, not componentized.
- No nav bar duplication needed if the home page already links everywhere;
  keep a minimal persistent nav/footer across all pages regardless for
  consistency (see Layout below).

### Writing (`/writing`, `/writing/[slug]`)
- Content collection: `src/content/writing/*.md`
- Frontmatter schema:
  ```yaml
  title: string
  date: date
  tags: string[] (optional)
  draft: boolean (optional, default false)
  dek: string (optional, one-line summary shown in the list view)
  ```
- List view: title, date, optional one-line dek. No thumbnails, no card
  grid — a clean vertical list, PostHog/Jaskaran-style.
- Post view: serif headings, sans body, max-width constrained for readability,
  no sidebar clutter.
- Draft posts (`draft: true`) excluded from the list and from build in
  production.

### Projects (`/projects`)
- Content collection: `src/content/projects/*.md`
- Frontmatter schema:
  ```yaml
  title: string
  description: string        # one-line summary
  status: string (optional)  # e.g. "active", "archived", "in progress"
  links: { repo?: string, live?: string }
  date: date (optional)      # for ordering
  ```
- Body of each `.md` file is the actual write-up — written with real specifics
  and honest retrospective (see Voice standard), not a resume bullet.
- Seed with: Harmony, Attend, Hisaab, Ritu Sharma portfolio site, Simplismart
  inference benchmark. Content to be written separately — scaffold the
  template and routing now, backfill real copy after.

### About (`/about`)
- Single markdown or hardcoded page. Not a bio in third person. First-person,
  anecdotal, specific — motorcycling, books, whatever's actually true.
- No profile photo required for v1 unless the person wants one.

### Lab (`/lab`)
- Placeholder for now: a single page with a plain-text note like "nothing
  here yet — check back." Linked from home like any other section.
- Architecturally this is the future home for one-off interactive builds
  (games, visualizations, toys). Each future entry should be its own fully
  self-contained Astro page under `/lab/[experiment]` — free to use its own
  JS/canvas/whatever, with no obligation to match the site's typographic
  system beyond a shared nav/footer.

## 4. Layout shell

- Persistent minimal nav (text links, not a hamburger menu, not a logo mark
  unless the person wants a simple wordmark) and footer across all pages.
- Nav: Home / Writing / Projects / About / Lab, plain text, current page
  optionally underlined or in `--accent-link`.
- Footer: minimal — copyright line, maybe 1-2 external links (GitHub,
  email) as plain text, no icon soup.
- No max-width breakout for nav/footer; content area constrained to a
  comfortable reading column, nav/footer can span slightly wider.

## 5. Content authoring workflow (why this should be "easy to add to")

- **New writing post** = add one `.md` file to `src/content/writing/` with
  frontmatter. Astro's content collections auto-generate the route and the
  list-view entry. Zero code changes required.
- **New project** = same pattern under `src/content/projects/`.
- **New Lab experiment** = requires actual code (it's a custom interactive
  page), but should follow a simple starter template/convention so each new
  one can be scaffolded quickly by Claude Code on request. Not zero-code,
  but low-friction.

## 6. Voice standard (for written content, not code)

Applies most to `/about` and `/projects`, where generic portfolio language
tends to creep in by default.

- Specific over polished: "I tried X, it was wrong for these reasons, here's
  what I do now" beats "I believe in iterative development."
- Numbers, dates, and concrete details over vague claims.
- Willing to admit an earlier belief or decision was wrong — that's what
  makes the current view feel earned.
- No hedging ("arguably," "some might say") — commit to the actual opinion.
- Titles can carry a point of view (see Jaskaran Bhatia's and PostHog's
  writing for reference) rather than defaulting to generic/descriptive titles.

This is a writing discipline for whoever drafts the content — not something
to enforce in code — but worth stating explicitly so placeholder/sample copy
doesn't accidentally ship as final copy.

## 7. Non-goals for v1

- No CMS, no admin UI — content is authored via files + git.
- No comments system, no newsletter signup, no analytics dashboard — can be
  added later if wanted, not part of this build.
- No dark-mode toggle UI — respect system preference only.
- No auth, no database, no dynamic backend — fully static site.

## 8. Build order (suggested)

1. Scaffold Astro project + content collections (writing, projects) with
   typed frontmatter schemas (Zod, via Astro's built-in content config).
2. Build the layout shell — nav, footer, base typography, color tokens,
   light/dark mode — before any real content. This is the whole visual
   identity; get it right first.
3. Writing list + post template, with 1-2 placeholder posts to verify layout.
4. Projects list + template, with 1-2 placeholder projects.
5. Home page (intro paragraph + links).
6. About page.
7. Lab placeholder page.
8. Netlify deploy config (`netlify.toml`, build command, publish dir).

## 9. Deploy

- Netlify, connected to GitHub repo, auto-deploy on push to `main`.
- Default `*.netlify.app` subdomain for now.
- Custom domain to be added later — architecture should not assume or
  hardcode the eventual domain anywhere.
