import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { excerpt, slugify } from '../lib/format';
import { allTagged, COLLECTION_LABELS, labelFor, tagLabels, usedTags } from '../lib/tags';

/**
 * The search index, built at compile time and served as one static file.
 *
 * The whole corpus is small enough that the palette can fetch all of it once
 * and match in the browser — no Pagefind, no hosted search, nothing to keep in
 * sync. Fields are single-letter because this ships over the wire:
 *
 *   t  title          k  kind label        u  url
 *   s  subtitle       b  body text matched against but never displayed
 *
 * Drafts are excluded in production by allTagged; a search box that surfaces
 * unpublished titles would defeat the point of the draft flag.
 */
type Doc = { t: string; s?: string; k: string; u: string; b?: string };

export const GET: APIRoute = async () => {
  const [tagged, labels, tags, writing, recommendations, lab] = await Promise.all([
    allTagged(),
    tagLabels(),
    usedTags(),
    getCollection('writing', ({ data }) => (import.meta.env.PROD ? data.draft !== true : true)),
    getCollection('recommendations'),
    getEntry('pages', 'lab'),
  ]);

  // Bodies, keyed by the same collection+id the flattened entries use, so the
  // full text of a post is searchable without it being in the display fields.
  const bodies = new Map<string, string>([
    ...writing.map((e) => [`writing:${e.id}`, excerpt(e.body ?? '', 2000)] as const),
    ...recommendations.map(
      (e) => [`recommendations:${e.id}`, excerpt(e.body ?? '', 2000)] as const,
    ),
  ]);

  const docs: Doc[] = [
    // The fixed pages. Hand-written rather than derived: there are seven of
    // them and each wants its own searchable phrasing.
    { t: 'Home', k: 'Page', u: '/', b: 'shreyas athreya intro about index' },
    { t: 'About', k: 'Page', u: '/about', b: 'bio motorcycles books languages who' },
    { t: 'Writing', k: 'Page', u: '/writing', b: 'posts notes essays blog' },
    { t: 'Projects', k: 'Page', u: '/projects', b: 'built work portfolio' },
    { t: 'Recommendations', k: 'Page', u: '/recommendations', b: 'books links tools shelf' },
    { t: 'Lab', k: 'Page', u: '/lab', b: 'experiments interactive toys visualizations' },
    { t: 'Tags', k: 'Page', u: '/tags', b: 'topics ideas index browse' },

    ...tagged.map((item) => ({
      t: item.title,
      s: item.description ?? undefined,
      k: COLLECTION_LABELS[item.collection],
      u: item.href,
      b: [
        item.tags.map((id) => labelFor(id, labels)).join(' '),
        bodies.get(`${item.collection}:${item.id}`) ?? '',
      ]
        .join(' ')
        .trim(),
    })),

    ...tags.map((tag) => ({
      t: tag.label,
      s: `${tag.count} ${tag.count === 1 ? 'entry' : 'entries'}`,
      k: 'Tag',
      u: `/tags/${tag.id}`,
    })),

    // Lab items are sections of /lab rather than pages, so they link to the
    // anchor on that page — same rule as the recommendations above: a result
    // takes you to the thing itself, not to the top of a page to hunt for it.
    ...(lab?.data.items ?? []).map((item) => ({
      t: item.title,
      s: 'On the Lab page',
      k: 'Lab',
      u: `/lab#${slugify(item.title)}`,
      b: item.body ?? '',
    })),
  ];

  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json' },
  });
};
