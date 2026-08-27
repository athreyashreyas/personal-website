import { getCollection } from 'astro:content';
import { formatDate } from './format';
import type { OgCard } from './og';
import { usedTags } from './tags';

/**
 * Every OG card the build should produce.
 *
 * This is the single source of truth for both halves of the feature: the
 * endpoint at /og/[...path].png generates exactly this list, and BaseLayout
 * checks a page's derived path against it before pointing og:image anywhere.
 * Keeping them on one list is what stops a page advertising a card that was
 * never rendered.
 *
 * Section index cards repeat the sub-line each page shows under its heading,
 * so the card and the page say the same thing.
 */
export async function ogCards(): Promise<OgCard[]> {
  const [writing, projects, tags] = await Promise.all([
    getCollection('writing', ({ data }) => (import.meta.env.PROD ? data.draft !== true : true)),
    getCollection('projects'),
    usedTags(),
  ]);

  return [
    {
      path: 'home',
      eyebrow: 'Personal site',
      title: 'Writing, projects, and a bit of a self-portrait',
    },
    { path: 'about', eyebrow: 'About', title: 'Who is actually writing all this' },
    { path: 'writing', eyebrow: 'Writing', title: 'Notes and longer pieces, most recent first' },
    {
      path: 'projects',
      eyebrow: 'Projects',
      title: "Things I've built, with the honest version of how they went",
    },
    {
      path: 'recommendations',
      eyebrow: 'Recommendations',
      title: 'Books, links, tools, and interesting things worth your time',
    },
    {
      path: 'lab',
      eyebrow: 'Lab',
      title: "One-off interactive things that don't belong anywhere else",
    },
    { path: 'tags', eyebrow: 'Tags', title: 'Everything on this site, by idea' },

    ...writing.map((entry) => ({
      path: `writing/${entry.id}`,
      eyebrow: 'Writing',
      title: entry.data.title,
      meta: formatDate(entry.data.date),
    })),
    ...projects.map((entry) => ({
      path: `projects/${entry.id}`,
      eyebrow: 'Project',
      title: entry.data.title,
      meta: entry.data.status ?? undefined,
    })),
    ...tags.map((tag) => ({
      path: `tags/${tag.id}`,
      eyebrow: 'Tag',
      title: tag.label,
      meta: `${tag.count} ${tag.count === 1 ? 'entry' : 'entries'}`,
    })),
  ];
}

/**
 * The card path a page's URL corresponds to: '/' → 'home', '/writing/foo' →
 * 'writing/foo'. Purely syntactic — whether that card exists is a separate
 * question, answered by ogImageFor below.
 */
export function ogPathFor(pathname: string): string {
  const trimmed = pathname.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? 'home' : trimmed;
}

/** The generated paths, built once per build and reused by every page. */
let pathsPromise: Promise<Set<string>> | undefined;

/**
 * The site-relative og:image for a page, falling back to the home card for
 * anything with no card of its own — 404, and the dev-only /lab/previews.
 * Every page gets a real image either way: the fallback is a card, not a
 * missing tag.
 */
export async function ogImageFor(pathname: string): Promise<string> {
  pathsPromise ??= ogCards().then((cards) => new Set(cards.map((card) => card.path)));
  const path = ogPathFor(pathname);
  return `/og/${(await pathsPromise).has(path) ? path : 'home'}.png`;
}
