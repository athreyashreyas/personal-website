import { getCollection } from 'astro:content';

/** The collections that can carry tags. Lab items and singleton pages cannot. */
export type TaggableCollection = 'writing' | 'projects' | 'recommendations';

/**
 * One tagged thing, flattened so a tag page, a "related" strip and the search
 * index can all iterate the same shape instead of each re-learning the three
 * collections' differing frontmatter.
 */
export type Tagged = {
  collection: TaggableCollection;
  id: string;
  title: string;
  /**
   * Where the link goes — always somewhere on this site.
   *
   * Writing and projects have pages of their own. A recommendation has no
   * detail page, so it anchors to its note in the /recommendations list: if
   * you found the entry here, what you want first is what was written about
   * it, and the link out to the source is on the title once you land.
   */
  href: string;
  /** One line of context for a list view, when the entry has one. */
  description: string | null;
  date: Date;
  /** Tag *ids* (filenames in src/content/tags), never display text. */
  tags: string[];
};

/** How each collection is labelled wherever entries from several are mixed. */
export const COLLECTION_LABELS: Record<TaggableCollection, string> = {
  writing: 'Writing',
  projects: 'Project',
  recommendations: 'Recommendation',
};

/**
 * Tag id → display label, from the controlled vocabulary in src/content/tags.
 *
 * An id with no matching entry is not in here; callers fall back to the id
 * itself, so a tag deleted out from under an entry reads as a slightly ugly
 * label rather than making the entry vanish. Same bargain as lib/shelf.ts.
 */
export async function tagLabels(): Promise<Map<string, string>> {
  const tags = await getCollection('tags');
  return new Map(tags.map((t) => [t.id, t.data.label]));
}

/** The label for one tag id, with the fall back to the raw id. */
export function labelFor(id: string, labels: Map<string, string>): string {
  return labels.get(id) ?? id;
}

/**
 * Every tagged entry across the three collections, newest first.
 *
 * Drafts follow the same rule as the Writing list: visible while authoring,
 * gone from the production build — which also keeps them out of tag pages and
 * the search index, neither of which should leak an unpublished title.
 */
export async function allTagged(): Promise<Tagged[]> {
  const [writing, projects, recommendations] = await Promise.all([
    getCollection('writing', ({ data }) => (import.meta.env.PROD ? data.draft !== true : true)),
    getCollection('projects'),
    getCollection('recommendations'),
  ]);

  const items: Tagged[] = [
    ...writing.map((entry) => ({
      collection: 'writing' as const,
      id: entry.id,
      title: entry.data.title,
      href: `/writing/${entry.id}`,
      description: entry.data.dek ?? null,
      date: entry.data.date,
      tags: entry.data.tags ?? [],
    })),
    ...projects.map((entry) => ({
      collection: 'projects' as const,
      id: entry.id,
      title: entry.data.title,
      href: `/projects/${entry.id}`,
      description: entry.data.description,
      date: entry.data.date ?? new Date(0),
      tags: entry.data.tags ?? [],
    })),
    ...recommendations.map((entry) => ({
      collection: 'recommendations' as const,
      id: entry.id,
      title: entry.data.title,
      // Anchored to the entry's own row in the list — see the note on `href`.
      href: `/recommendations#${entry.id}`,
      description: entry.data.category ?? null,
      date: entry.data.date,
      tags: entry.data.tags ?? [],
    })),
  ];

  // Slug breaks date ties for the same reason applyOrder does it: entries
  // added in one sitting share a date, and getCollection's order is not
  // stable between dev and a build.
  return items.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id),
  );
}

/** Tag id → the entries carrying it, each list already newest-first. */
export async function tagIndex(): Promise<Map<string, Tagged[]>> {
  const index = new Map<string, Tagged[]>();
  for (const item of await allTagged()) {
    for (const tag of item.tags) {
      const bucket = index.get(tag);
      if (bucket) bucket.push(item);
      else index.set(tag, [item]);
    }
  }
  return index;
}

/**
 * The tags actually in use, most-used first, with their labels and counts.
 *
 * Driven by the index rather than the `tags` collection so a vocabulary entry
 * nothing references yet doesn't generate an empty page.
 */
export async function usedTags(): Promise<
  { id: string; label: string; count: number }[]
> {
  const [index, labels] = await Promise.all([tagIndex(), tagLabels()]);
  return [...index.entries()]
    .map(([id, items]) => ({ id, label: labelFor(id, labels), count: items.length }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
