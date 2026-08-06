import { getCollection } from 'astro:content';

/** One recommendation, with its tag ids already resolved to display labels. */
export type ShelfItem = {
  title: string;
  url: string | null;
  category: string | null;
  tags: string[];
};

/**
 * The recommendations, newest first, ready for anything that draws the shelf.
 *
 * Recommendations store tag *ids* (see the `tags` collection in
 * content.config.ts), so the labels have to be looked up rather than read
 * straight off the entry. An id with no matching tag entry falls back to
 * itself: a tag deleted out from under a recommendation should show as a
 * slightly ugly label, not vanish from the page.
 */
export async function shelfItems(): Promise<ShelfItem[]> {
  const [recommendations, tags] = await Promise.all([
    getCollection('recommendations'),
    getCollection('tags'),
  ]);

  const labels = new Map(tags.map((t) => [t.id, t.data.label]));

  if (import.meta.env.DEV) {
    const dangling = [
      ...new Set(
        recommendations.flatMap((r) => (r.data.tags ?? []).filter((id) => !labels.has(id))),
      ),
    ];
    if (dangling.length > 0) {
      console.warn(
        `[shelf] Recommendations reference tags that don't exist: ${dangling.join(', ')}. ` +
          'Add them under src/content/tags/, or fix the entries using them.',
      );
    }
  }

  return recommendations
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .map((r) => ({
      title: r.data.title,
      url: r.data.url ?? null,
      category: r.data.category ?? null,
      tags: (r.data.tags ?? []).map((id) => labels.get(id) ?? id),
    }));
}
