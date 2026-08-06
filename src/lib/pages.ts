import { getEntry, render } from 'astro:content';

/** The CMS-editable single pages, one src/content/<id>.mdx each. */
export type PageId = 'home' | 'about' | 'lab';

/**
 * Fetch and render one of the singleton pages.
 *
 * `getEntry` returns undefined when the .mdx is missing — but also, transiently,
 * while the content layer is reloading its store (which it does whenever
 * content.config.ts changes, or a content file is written by the CMS while the
 * dev server is running). Passing that undefined straight to `render`, as the
 * pages used to via `render(entry!)`, throws RenderUndefinedEntryError: a stack
 * trace pointing at Astro's internals with no mention of which page failed.
 *
 * Failing here instead names the entry and the usual fix.
 */
export async function renderPage(id: PageId) {
  const entry = await getEntry('pages', id);
  if (!entry) {
    throw new Error(
      `Missing content entry "pages/${id}" — expected src/content/${id}.mdx.\n` +
        `If that file exists, the content layer's cache is stale rather than the ` +
        `page being gone: stop the dev server, delete the .astro directory, and ` +
        `start it again.`,
    );
  }
  return render(entry);
}
