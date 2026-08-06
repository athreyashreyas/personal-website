import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Keystatic writes empty optional fields as "" — normalize those to undefined
// so validation stays happy whether a file is hand-written or CMS-authored.
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    dek: optionalString,
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: optionalString,
    links: z
      .object({
        repo: optionalUrl,
        live: optionalUrl,
        /** A write-up that lives elsewhere — a doc, a report, a slide deck. */
        doc: optionalUrl,
      })
      .default({}),
    date: z.coerce.date().optional(),
  }),
});

/**
 * The controlled tag vocabulary. One entry per tag, filename = the canonical
 * id; recommendations reference those ids rather than repeating free text.
 *
 * This is what stops "Public Policy", "public policy" and "public  policy"
 * becoming three tags: they all slugify to `public-policy`, and Keystatic
 * refuses to create a second entry at a slug that already exists, so the only
 * way to tag something is to pick the tag that is already there.
 */
const tags = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/tags' }),
  schema: z.object({
    label: z.string(),
  }),
});

const recommendations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/recommendations' }),
  schema: z.object({
    title: z.string(),
    url: optionalUrl,
    category: optionalString,
    /** Ids from the `tags` collection above, not display text. */
    tags: z.array(z.string()).default([]),
    date: z.coerce.date(),
  }),
});

// Editable single pages (home intro, about, lab), managed as Keystatic
// singletons that write to src/content/<name>.mdx.
const pages = defineCollection({
  loader: glob({ pattern: '{home,about,lab}.mdx', base: './src/content' }),
  schema: z.object({}),
});

export const collections = { writing, projects, recommendations, tags, pages };
