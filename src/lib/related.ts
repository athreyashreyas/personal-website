import { allTagged, type Tagged } from './tags';

/**
 * The entries most worth reading next to `current`, ranked by shared tags.
 *
 * Two deliberate biases in the tie-break:
 *
 * - A match from a *different* collection wins over one from the same
 *   collection. Another post about the same idea is a decent suggestion; the
 *   book that idea came from is a better one, and it's the cross-collection
 *   hop that the tag vocabulary exists to make possible at all.
 * - After that, newer wins, so a growing collection doesn't leave every page
 *   pointing at the same three oldest entries forever.
 *
 * Returns [] when nothing shares a tag — including the common case of an entry
 * with no tags at all — so callers can drop the section rather than render an
 * empty heading.
 */
export function rankRelated(current: Tagged, pool: Tagged[], limit = 4): Tagged[] {
  const own = new Set(current.tags);
  if (own.size === 0) return [];

  return pool
    .filter((item) => !(item.collection === current.collection && item.id === current.id))
    .map((item) => ({ item, shared: item.tags.filter((tag) => own.has(tag)).length }))
    .filter(({ shared }) => shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        Number(a.item.collection === current.collection) -
          Number(b.item.collection === current.collection) ||
        b.item.date.getTime() - a.item.date.getTime() ||
        a.item.id.localeCompare(b.item.id),
    )
    .slice(0, limit)
    .map(({ item }) => item);
}

/**
 * `rankRelated` against the whole site, for a page that only knows its own
 * collection and slug.
 */
export async function relatedTo(
  collection: Tagged['collection'],
  id: string,
  limit = 4,
): Promise<Tagged[]> {
  const pool = await allTagged();
  const current = pool.find((item) => item.collection === collection && item.id === id);
  return current ? rankRelated(current, pool, limit) : [];
}
