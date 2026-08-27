/** e.g. "Feb 14, 2025" */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** ISO date (YYYY-MM-DD) for <time datetime> */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A rough plain-text rendering of a Markdown/MDX body.
 *
 * Deliberately a regex pass rather than a real parse: the consumer is the
 * search index, which wants body text to match against and never displays it,
 * and pulling remark into an endpoint to produce that is a lot of machinery
 * for something nobody reads. It strips the syntax it knows and leaves
 * anything exotic as-is, which degrades to slightly noisy text rather than to
 * something wrong.
 */
export function plainText(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')        // frontmatter, if still attached
    .replace(/```[\s\S]*?```/g, ' ')             // fenced code
    .replace(/^import\s.+$/gm, ' ')              // MDX imports
    .replace(/<[^>]+>/g, ' ')                    // HTML and JSX tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')       // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')     // links → their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')          // headings
    .replace(/^\s{0,3}>\s?/gm, '')               // blockquotes
    .replace(/^\s*[-*+]\s+/gm, '')               // list bullets
    .replace(/[*_`]/g, '')                       // emphasis and inline code
    .replace(/\s+/g, ' ')
    .trim();
}

/** `plainText`, cut to roughly `limit` characters on a word boundary. */
export function excerpt(markdown: string, limit = 280): string {
  const text = plainText(markdown);
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * A url-safe anchor id from a piece of display text.
 *
 * Used for the Lab items, which live as an array inside one page rather than
 * as files with slugs of their own — so unlike every other collection there is
 * no id to link to until one is derived. Kept in step with Keystatic's own
 * slugging (lower case, non-alphanumerics collapsed to a single dash) so a
 * title reads the same in a URL wherever it came from.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
