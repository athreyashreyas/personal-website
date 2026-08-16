import yaml from 'js-yaml';
// Imported as text rather than read with fs so Vite tracks it as a module
// dependency: editing the file in the CMS while `npm run dev` is running
// reloads the affected pages, instead of serving a copy parsed once at boot.
import orderingSource from '../content/ordering.yaml?raw';

/**
 * Manual ordering, layered over the date-added default.
 *
 * Both lists on the Ordering screen are partial by design. Whatever is in one
 * is pinned to the top of its page in exactly that sequence; everything else
 * falls in underneath, newest first. That keeps the common case free — a new
 * entry lands in date order without anyone touching the list — while still
 * allowing a deliberate arrangement of the few entries that need it.
 *
 * An empty list is therefore not a special case: it is the default behaviour.
 */
export type OrderedSection = 'writing' | 'recommendations';

const parsed = (yaml.load(orderingSource) ?? {}) as Record<string, unknown>;

/** The pinned slugs for a section, ignoring anything malformed in the YAML. */
function pinnedIds(section: OrderedSection): string[] {
  const value = parsed[section];
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Sort `entries` for `section`: pinned ones first in their listed order, then
 * the rest by date, newest first.
 *
 * A pinned slug with no matching entry is skipped rather than throwing — the
 * CMS leaves the id behind when an entry is deleted, and a stale line in a
 * config file should not take the page down.
 */
export function applyOrder<T extends { id: string }>(
  section: OrderedSection,
  entries: T[],
  dateOf: (entry: T) => Date,
): T[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const pinned = pinnedIds(section)
    .map((id) => byId.get(id))
    .filter((entry): entry is T => entry !== undefined);

  const seen = new Set(pinned.map((entry) => entry.id));
  const rest = entries
    .filter((entry) => !seen.has(entry.id))
    // Slug breaks ties, because several entries sharing a date is normal — a
    // batch added in one sitting all default to today. Without it the order
    // within that group is whatever getCollection happened to return, which is
    // not the same in dev as in a build, so the page silently reshuffles when
    // it ships.
    .sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime() || a.id.localeCompare(b.id));

  return [...pinned, ...rest];
}

/**
 * Lab items are an array inside the Lab singleton, so the array *is* the
 * manual order — there is no separate list to pin against. The checkbox on the
 * Lab page chooses between that arrangement and the date-added default.
 *
 * Sorting by date leaves items sharing a date in their authored order, since
 * Array.prototype.sort is stable.
 */
export function orderLabItems<T extends { date: Date }>(manual: boolean, items: T[]): T[] {
  if (manual) return items;
  return [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
}
